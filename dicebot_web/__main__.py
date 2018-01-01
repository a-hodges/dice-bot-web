#!/usr/bin/env python3

import os
import argparse
import enum
from operator import itemgetter

import requests
from flask import (
    Flask,
    abort,
    flash,
    redirect,
    render_template,
    request,
    send_from_directory,
    session,
    url_for,
)
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm.exc import NoResultFound, MultipleResultsFound
from flask_sqlalchemy import SQLAlchemy
from flask_restful import Resource, Api
from requests_oauthlib import OAuth2Session

from dicebot import model as m

# Create App
application = Flask(__name__)
application.jinja_env.trim_blocks = True
application.jinja_env.lstrip_blocks = True
application.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
application.config['SQLALCHEMY_DATABASE_URI'] = None
api = Api(application)
# Attach Database
db = SQLAlchemy(application)
db.Model = m.Base
# Configure Discord OAuth
API_BASE_URL = 'https://discordapp.com/api'
AUTHORIZATION_BASE_URL = API_BASE_URL + '/oauth2/authorize'
TOKEN_URL = API_BASE_URL + '/oauth2/token'
os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = 'true'  # possibly insecure


# ----#-   Utilities


def get_user_avatar(user, size=32):
    '''
    Gets the url for the user's avatar
    '''
    if user.get('avatar') is None:
        return 'https://cdn.discordapp.com/embed/avatars/{0}.png?size={1}'.format(int(user['discriminator']) % 5, size)
    else:
        return 'https://cdn.discordapp.com/avatars/{0[id]}/{0[avatar]}.png?size={1}'.format(user, size)


def get_guild_icon(guild, size=32):
    '''
    Gets the url for the guild's icon
    '''
    if guild.get('icon') is None:
        return 'https://cdn.discordapp.com/embed/avatars/0.png?size={1}'.format(guild, size)
    else:
        return 'https://cdn.discordapp.com/icons/{0[id]}/{0[icon]}.png?size={1}'.format(guild, size)


def get_user(token=None):
    discord = make_session(token=token)
    user = discord.get(API_BASE_URL + '/users/@me').json()
    return user if 'id' in user else None, discord


def entry2json(entry):
    entry = entry.dict()
    for key, value in entry.items():
        if isinstance(value, enum.Enum):
            entry[key] = value.name
    return entry


def table2json(table):
    data = [entry2json(item) for item in table]
    return data


# ----#-   Application


def create_app(database):
    '''
    Sets up app for use
    Adds database configuration and the secret key
    '''
    if database is not None and database != application.config['SQLALCHEMY_DATABASE_URI']:
        # setup Database
        application.config['SQLALCHEMY_DATABASE_URI'] = database
        db.create_all()

        # setup config values
        with application.app_context():
            # these settings are stored in the configuration table
            # values here are defaults (and should all be strings or null)
            # defaults will autopopulate the database when first initialized
            # when run subsequently, they will be populated from the database
            # only populated on startup, changes not applied until restart
            config = {
                # key used to encrypt cookies
                'token': None,
                'discord_client_id': None,
                'discord_client_secret': None,
            }
            # get Config values from database
            for name in config:
                try:
                    key = db.session.query(m.Config).filter_by(name=name).one()
                    config[name] = key.value
                except NoResultFound:
                    key = m.Config(name=name, value=config[name])
                    db.session.add(key)
                    db.session.commit()

            application.config.update(config)
            application.secret_key = application.config['token']


@application.context_processor
def context():
    '''
    Makes extra variables available to the template engine
    '''
    return dict(
        m=m,
        str=str,
        len=len,
        AUTHORIZATION_BASE_URL=AUTHORIZATION_BASE_URL,
    )


def error(e, message):
    '''
    Basic error template for all error pages
    '''

    html = render_template(
        'error.html',
        title=str(e),
        message=message,
    )
    return html


@application.errorhandler(400)
def four_hundred(e):
    '''
    400 (bad request) error page
    '''
    return error(e, "Bad request."), 400


@application.errorhandler(403)
def four_oh_three(e):
    '''
    403 (forbidden) error page
    '''
    return error(e, "You don't have access to this page."), 403


@application.errorhandler(404)
def four_oh_four(e):
    '''
    404 (page not found) error page
    '''
    return error(e, "We couldn't find the page you were looking for."), 404


@application.errorhandler(500)
def five_hundred(e):
    '''
    500 (internal server) error page
    '''
    if isinstance(e, NoResultFound):
        message = 'Could not find the requested item in the database.'
    elif isinstance(e, MultipleResultsFound):
        message = 'Found too many results for the requested resource.'
    elif isinstance(e, IntegrityError):
        message = 'Invalid data entered. '
        message += 'Either a duplicate record was entered or '
        message += 'not all fields were filled out.'
    else:
        message = 'Whoops, looks like something went wrong!'
    return error('500: ' + type(e).__name__, message), 500


@application.route('/favicon.ico')
def favicon():
    '''
    The favorites icon for the site
    '''
    return send_from_directory(
        os.path.join(application.root_path, 'static', 'images'),
        'favicon.ico',
        mimetype='image/vnd.microsoft.icon',
    )


# ----#-   Pages


@application.route('/')
def index():
    '''
    Homepage for the bot
    '''
    user, discord = get_user(session.get('oauth2_token'))

    if user:
        user['avatar'] = get_user_avatar(user)
        characters = db.session.query(m.Character).filter_by(user=user.get('id')).order_by(m.Character.name).all()
        characters = {str(c.server): c for c in characters}
        guilds = discord.get(API_BASE_URL + '/users/@me/guilds').json()
        guilds = filter(bot_in_guild, guilds)
        guilds = sorted(guilds, key=itemgetter('name'))
        for guild in guilds:
            guild['icon'] = get_guild_icon(guild)
        other_guilds = [guild for guild in guilds if guild['id'] not in characters]
        characters = [(characters[guild['id']], guild) for guild in guilds if guild['id'] in characters]
    else:
        characters = None
        other_guilds = None

    return render_template(
        'index.html',
        title='Dice-Bot',
        user=user,
        characters=characters,
        other_guilds=other_guilds,
    )


@application.route('/character')
def character():
    '''
    Character homepage, allows access to character attributes
    '''
    user, discord = get_user(session.get('oauth2_token'))

    server = request.args.get('server')

    if not user:
        abort(403)
    if not server:
        abort(400)

    character = db.session.query(m.Character).filter_by(user=user.get('id'), server=server).one_or_none()

    if not character:
        abort(400)

    user['avatar'] = get_user_avatar(user)
    guilds = {guild['id']: guild for guild in discord.get(API_BASE_URL + '/users/@me/guilds').json()}
    guild = guilds.get(str(character.server), {})
    guild['icon'] = get_guild_icon(guild)

    return render_template(
        'character.html',
        user=user,
        title=character.name,
        character=character,
        guild=guild,
    )


@application.route('/unclaim')
def unclaim():
    '''
    Removes a claim on a specific character
    '''
    user, discord = get_user(session.get('oauth2_token'))

    server = request.args.get('server')

    if not user:
        abort(403)
    if not server:
        abort(400)

    character = db.session.query(m.Character).filter_by(user=user.get('id'), server=server).one_or_none()
    character.user = None
    db.session.commit()

    return redirect(url_for('index'))


@application.route('/pick_character')
def pick_character():
    '''
    Pick a character from the server or create a new one
    '''
    user, discord = get_user(session.get('oauth2_token'))
    if not user:
        abort(403)

    guild = request.args.get('server')
    if not guild:
        abort(400)

    user['avatar'] = get_user_avatar(user)
    guilds = {guild['id']: guild for guild in discord.get(API_BASE_URL + '/users/@me/guilds').json()}
    guild = guilds.get(guild, {})
    guild['icon'] = get_guild_icon(guild)

    characters = db.session.query(m.Character).filter_by(server=guild['id'], user=None).order_by(m.Character.name).all()

    return render_template(
        'pick_character.html',
        user=user,
        title=guild['name'],
        guild=guild,
        characters=characters,
    )


@application.route('/claim_character')
def claim_character():
    '''
    Claim an existing character
    '''
    user, discord = get_user(session.get('oauth2_token'))
    if not user:
        abort(403)

    server = request.args.get('server')
    name = request.args.get('character')
    if not server or not name:
        abort(400)

    character = db.session.query(m.Character).filter_by(name=name, server=server).one_or_none()

    if character is None:
        character = m.Character(name=name, server=server, user=user['id'])
        try:
            db.session.add(character)
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            abort(409)
    elif character.user is not None:
        abort(409)
    else:
        character.user = user['id']
        db.session.commit()

    return redirect(url_for('index'))


# ----#-   REST endpoints


class Object (Resource):
    def get_character(self):
        '''
        Uses character data and request arguments to select a character

        If successful returns a character
        If unsuccessful calls an abort function
        '''
        if request.method in ['POST', 'PUT', 'PATCH', 'DELETE']:
            args = request.form
        else:
            args = request.args

        user, discord = get_user(session.get('oauth2_token'))
        if not user:
            abort(403)

        guild_id = args.get('server')

        if not guild_id:
            abort(400)

        character = db.session.query(m.Character).filter_by(user=user.get('id'), server=guild_id).one_or_none()

        if not character:
            abort(400)

        return character

    def get(self):
        character = self.get_character()
        data = db.session.query(self.type)\
            .filter_by(character_id=character.id)\
            .order_by(self.order).all()
        return table2json(data)

    def post(self):
        character = self.get_character()
        item = self.type(character_id=character.id)
        for field, cast in self.fields.items():
            if cast == int:
                data = request.form.get(field) or 0
            elif isinstance(cast, enum.EnumMeta):
                data = cast[request.form.get(field, 'other')]
            else:
                data = request.form.get(field, '')
            setattr(item, field, cast(data))

        try:
            db.session.add(item)
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            abort(409)
        else:
            return entry2json(item)

    def patch(self):
        id = request.form.get('id')
        if id is None:
            abort(400)
        character = self.get_character()
        item = db.session.query(self.type).filter_by(character_id=character.id, id=id).one_or_none()
        if item is None:
            abort(404)

        for field, cast in self.fields.items():
            if field in request.form:
                if cast == int:
                    setattr(item, field, cast(request.form[field] or 0))
                elif isinstance(cast, enum.EnumMeta):
                    setattr(item, field, cast[request.form[field]])
                else:
                    setattr(item, field, cast(request.form[field]))

        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            abort(409)
        return entry2json(item)

    def delete(self):
        id = request.form.get('id')
        if id is None:
            abort(400)
        character = self.get_character()
        item = db.session.query(self.type).filter_by(character_id=character.id, id=id).one_or_none()
        if item is not None:
            db.session.delete(item)
            db.session.commit()
        return {'message': 'successful'}


class Constant (Object):
    type = m.Constant
    order = 'name'
    fields = {
        'name': str,
        'value': int,
    }


api.add_resource(Constant, '/constants')


class Roll (Object):
    type = m.Roll
    order = 'name'
    fields = {
        'name': str,
        'expression': str,
    }


api.add_resource(Roll, '/rolls')


class Resource (Object):
    type = m.Resource
    order = 'name'
    fields = {
        'name': str,
        'current': int,
        'max': int,
        'recover': m.Rest,
    }


api.add_resource(Resource, '/resources')


class Spell (Object):
    type = m.Spell
    order = 'level,name'
    fields = {
        'name': str,
        'level': int,
        'description': str,
    }


api.add_resource(Spell, '/spells')


class Item (Object):
    type = m.Item
    order = 'name'
    fields = {
        'name': str,
        'number': int,
        'description': str,
    }


api.add_resource(Item, '/inventory')


# ----#-   Login/Logout


def token_updater(token):
    session['oauth_token'] = token


def make_session(token=None, state=None, scope=None):
    client_id = application.config['discord_client_id']
    client_secret = application.config['discord_client_secret']
    return OAuth2Session(
        client_id=client_id,
        token=token,
        state=state,
        scope=scope,
        redirect_uri=url_for('callback', _external=True),
        auto_refresh_kwargs={
            'client_id': client_id,
            'client_secret': client_secret,
        },
        auto_refresh_url=TOKEN_URL,
        token_updater=token_updater,
    )


@application.route('/login/')
def login():
    '''
    Redirects the user to the Discord sign in page
    '''
    scope = request.args.get('scope', 'identify guilds')
    discord = make_session(scope=scope.split(' '))
    authorization_url, state = discord.authorization_url(AUTHORIZATION_BASE_URL)
    session['oauth2_state'] = state
    return redirect(authorization_url)


@application.route('/callback')
def callback():
    '''
    Logs the user in using the OAuth API
    '''
    if request.values.get('error'):
        return request.values['error']
    discord = make_session(state=session.get('oauth2_state'))
    token = discord.fetch_token(
        TOKEN_URL,
        client_secret=application.config['discord_client_secret'],
        authorization_response=request.url)
    session['oauth2_token'] = token
    return redirect(url_for('index'))


@application.route('/logout/')
def logout():
    '''
    Logs the user out and returns them to the homepage
    '''
    session.clear()
    flash(
        '&#10004; Successfully logged out. ' +
        'You will need to log out of Discord separately.')
    return redirect(url_for('index'))


def bot_in_guild(guild):
    '''
    Returns whether the bot is in the given guild
    The guild should be a dict as returned by discord Guild resources
    '''
    guild = requests.get(
        API_BASE_URL + '/guilds/{}'.format(guild.get('id')),
        headers={
            'Authorization': 'Bot ' + application.config['token'],
        },
    )
    return bool(guild)


# ----#-   Main

create_app(os.environ.get('DB', None))  # default database setup

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 80))  # default port
    parser = argparse.ArgumentParser(
        description='Tutoring Portal Server',
        epilog='The server runs locally on port %d if PORT is not specified.'
        % port)
    parser.add_argument(
        'database', nargs='?',
        help='The database url to be accessed')
    parser.add_argument(
        '-p, --port', dest='port', type=int,
        help='The port where the server will run')
    parser.add_argument(
        '--debug', dest='debug', action='store_true',
        help='run the server in debug mode')
    parser.add_argument(
        '--reload', dest='reload', action='store_true',
        help='reload on source update without restarting server (also debug)')
    args = parser.parse_args()
    if args.reload:
        args.debug = True

    if args.port is None:
        args.port = port

    create_app(args.database)

    if args.reload:
        application.config['TEMPLATES_AUTO_RELOAD'] = True

    application.run(
        host='0.0.0.0',
        port=args.port,
        debug=args.debug,
        use_reloader=args.reload,
    )
