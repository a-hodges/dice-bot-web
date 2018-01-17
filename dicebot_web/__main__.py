#!/usr/bin/env python3

import os
import argparse
import datetime
from operator import itemgetter

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

from util import (
    API_BASE_URL, AUTHORIZATION_BASE_URL, TOKEN_URL,
    get_user, user_get, user_in_guild,
    bot_in_guild,
    get_user_avatar, get_guild_icon,
    make_session,
)
from database import db, m
from restful import api_bp

# Create App
application = Flask(__name__)
application.jinja_env.trim_blocks = True
application.jinja_env.lstrip_blocks = True
application.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
application.config['SQLALCHEMY_DATABASE_URI'] = None
# Attach Database and REST
db.init_app(application)
application.register_blueprint(api_bp, url_prefix='/api')


# ----#-   Application


def create_app(database):
    '''
    Sets up app for use
    Adds database configuration and the secret key
    '''
    if database is not None and database != application.config['SQLALCHEMY_DATABASE_URI']:
        # setup Database
        application.config['SQLALCHEMY_DATABASE_URI'] = database

        # setup config values
        with application.app_context():
            db.create_all()
            # these settings are stored in the configuration table
            # values here are defaults (and should all be strings or null)
            # defaults will autopopulate the database when first initialized
            # when run subsequently, they will be populated from the database
            # only populated on startup, changes not applied until restart
            config = {
                # key used to encrypt cookies
                'token': None,
                # discord oauth2 id and secret
                'discord_client_id': None,
                'discord_client_secret': None,
                # cookie lifetime in days
                'PERMANENT_SESSION_LIFETIME': '1',
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
            application.config['PERMANENT_SESSION_LIFETIME'] = \
                datetime.timedelta(int(application.config['PERMANENT_SESSION_LIFETIME']))
            application.secret_key = application.config['token']


@application.before_request
def make_session_permanent():
    session.permanent = True


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
        guilds = user_get(discord, API_BASE_URL + '/users/@me/guilds').json()
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
    if not user:
        abort(403)

    character_id = request.args.get('character')
    if not character_id:
        abort(400)

    character = db.session.query(m.Character).get(character_id)
    if not character:
        abort(404)
    readonly = str(character.user) != user.get('id')

    user['avatar'] = get_user_avatar(user)
    guilds = {guild['id']: guild for guild in user_get(discord, API_BASE_URL + '/users/@me/guilds').json()}
    guild = guilds.get(str(character.server), {})
    guild['icon'] = get_guild_icon(guild)

    return render_template(
        'character.html',
        user=user,
        title=character.name,
        character=character,
        guild=guild,
        readonly=readonly,
    )


@application.route('/list_characters')
def list_characters():
    '''
    Lists all of the characters in a server
    '''
    user, discord = get_user(session.get('oauth2_token'))
    if not user:
        abort(403)

    guild = request.args.get('server')
    if not guild:
        abort(400)
    if not user_in_guild(guild, user['id']):
        abort(403)

    user['avatar'] = get_user_avatar(user)
    guilds = {guild['id']: guild for guild in user_get(discord, API_BASE_URL + '/users/@me/guilds').json()}
    guild = guilds.get(guild, {})
    guild['icon'] = get_guild_icon(guild, size=64)
    if not guild:
        abort(403)

    characters = db.session.query(m.Character).filter_by(server=guild['id']).order_by(m.Character.name).all()

    return render_template(
        'list_characters.html',
        user=user,
        title=guild['name'],
        guild=guild,
        characters=characters,
    )


@application.route('/unclaim')
def unclaim():
    '''
    Removes a claim on a specific character
    '''
    user, discord = get_user(session.get('oauth2_token'))
    if not user:
        abort(403)

    character_id = request.args.get('character')
    if not character_id:
        abort(400)

    character = db.session.query(m.Character).get(character_id)
    if not character:
        abort(404)
    if str(character.user) != user['id']:
        abort(403)

    character.user = None
    db.session.commit()

    return redirect(url_for('pick_character', server=character.server))


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
    if not user_in_guild(guild, user['id']):
        abort(403)

    user['avatar'] = get_user_avatar(user)
    guilds = {guild['id']: guild for guild in user_get(discord, API_BASE_URL + '/users/@me/guilds').json()}
    guild = guilds.get(guild, {})
    guild['icon'] = get_guild_icon(guild)
    if not guild:
        abort(403)

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

    guild = request.args.get('server')
    name = request.args.get('character')
    if not guild or not name:
        abort(400)
    if not user_in_guild(guild, user['id']):
        abort(403)

    character = db.session.query(m.Character).filter_by(name=name, server=guild).one_or_none()

    if character is None:
        character = m.Character(name=name, server=guild, user=user['id'])
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

    return redirect(url_for('character', character=character.id))


# ----#-   Login/Logout


@application.route('/login/')
def login():
    '''
    Redirects the user to the Discord sign in page
    '''
    scope = request.args.get('scope', 'identify guilds')
    discord = make_session(application, scope=scope.split(' '))
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
    discord = make_session(application, state=session.get('oauth2_state'))
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
