#!/usr/bin/env python3

import os
import argparse

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
from requests_oauthlib import OAuth2Session

from dicebot import model as m

# Create App
app = Flask(__name__)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
# Attach Database
db = SQLAlchemy(app)
db.Model = m.Base
# Configure Discord OAuth
API_BASE_URL = 'https://discordapp.com/api'
AUTHORIZATION_BASE_URL = API_BASE_URL + '/oauth2/authorize'
TOKEN_URL = API_BASE_URL + '/oauth2/token'


def create_app(database):
    '''
    Sets up app for use
    Adds database configuration and the secret key
    '''
    app.jinja_env.trim_blocks = True
    app.jinja_env.lstrip_blocks = True

    # setup Database
    app.config['SQLALCHEMY_DATABASE_URI'] = database
    db.create_all()

    # setup config values
    with app.app_context():
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

        app.config.update(config)
        app.secret_key = app.config['token']


@app.context_processor
def context():
    '''
    Makes extra variables available to the template engine
    '''
    return dict(
        m=m,
        str=str,
        len=len,
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


@app.errorhandler(403)
def four_oh_three(e):
    '''
    403 (forbidden) error page
    '''
    return error(e, "You don't have access to this page."), 403


@app.errorhandler(404)
def four_oh_four(e):
    '''
    404 (page not found) error page
    '''
    return error(e, "We couldn't find the page you were looking for."), 404


@app.errorhandler(500)
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


@app.route('/favicon.ico')
def favicon():
    '''
    The favorites icon for the site
    '''
    return send_from_directory(
        os.path.join(app.root_path, 'static', 'images'),
        'favicon.ico',
        mimetype='image/vnd.microsoft.icon',
    )


# ----#-   Pages


@app.route('/')
def index():
    '''
    Homepage for the bot
    '''
    user, discord = get_user()

    if user:
        user['avatar'] = get_user_avatar(user)
        characters = db.session.query(m.Character).filter_by(user=user.get('id')).order_by(m.Character.name).all()
        guilds = {guild['id']: guild for guild in discord.get(API_BASE_URL + '/users/@me/guilds').json()}
        guilds = [guilds.get(str(character.server), {}) for character in characters]
        for guild in guilds:
            guild['icon'] = get_guild_icon(guild)
        characters = zip(characters, guilds)
    else:
        characters = None

    return render_template(
        'index.html',
        title='Dice-Bot',
        user=user,
        characters=characters,
    )


@app.route('/character')
def character():
    '''
    Character homepage, allows access to character attributes
    '''
    user, discord = get_user()

    character = request.args.get('server')

    if not user or not character:
        return abort(403)

    character = db.session.query(m.Character).filter_by(user=user.get('id'), server=character).one_or_none()

    if not character:
        return abort(403)

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


@app.route('/constants')
def constants():
    '''
    Returns the current character's constants in json form
    '''
    ...


@app.route('/rolls')
def rolls():
    '''
    Returns the current character's constants in json form
    '''
    ...


@app.route('/resources')
def resources():
    '''
    Returns the current character's constants in json form
    '''
    ...


@app.route('/spells')
def spells():
    '''
    Returns the current character's constants in json form
    '''
    ...


@app.route('/inventory')
def inventory():
    '''
    Returns the current character's constants in json form
    '''
    ...


# ----#-   Login/Logout


def get_user_avatar(user, size=32):
    '''
    Gets the url for the user's avatar
    '''
    return 'https://cdn.discordapp.com/avatars/{0[id]}/{0[avatar]}.png?size={1}'.format(user, size)


def get_guild_icon(guild, size=32):
    '''
    Gets the url for the guild's icon
    '''
    return 'https://cdn.discordapp.com/icons/{0[id]}/{0[icon]}.png?size={1}'.format(guild, size)


def get_user():
    discord = make_session(token=session.get('oauth2_token'))
    user = discord.get(API_BASE_URL + '/users/@me').json()
    return user if 'id' in user else None, discord


def token_updater(token):
    session['oauth_token'] = token


def make_session(token=None, state=None, scope=None):
    client_id = app.config['discord_client_id']
    client_secret = app.config['discord_client_secret']
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


@app.route('/login/')
def login():
    '''
    Redirects the user to the Discord sign in page
    '''
    scope = request.args.get('scope', 'identify guilds')
    discord = make_session(scope=scope.split(' '))
    authorization_url, state = discord.authorization_url(AUTHORIZATION_BASE_URL)
    session['oauth2_state'] = state
    return redirect(authorization_url)


@app.route('/callback')
def callback():
    '''
    Logs the user in using the OAuth API
    '''
    if request.values.get('error'):
        return request.values['error']
    discord = make_session(state=session.get('oauth2_state'))
    token = discord.fetch_token(
        TOKEN_URL,
        client_secret=app.config['discord_client_secret'],
        authorization_response=request.url)
    session['oauth2_token'] = token
    return redirect(url_for('index'))


@app.route('/logout/')
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


def main():
    port = 80  # default port
    parser = argparse.ArgumentParser(
        description='Tutoring Portal Server',
        epilog='The server runs locally on port %d if PORT is not specified.'
        % port)
    parser.add_argument(
        'database', nargs='?', default='sqlite:///:memory:',
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
        app.config['TEMPLATES_AUTO_RELOAD'] = True

    if args.debug:
        os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = 'true'

    app.run(
        host='0.0.0.0',
        port=args.port,
        debug=args.debug,
        use_reloader=args.reload,
    )


if __name__ == '__main__':
    main()
