#!/usr/bin/env python3

import os
import argparse
import enum

from flask import (
    Flask,
    abort,
    flash,
    jsonify,
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


# ----#-   Utilities


def get_user_avatar(user, size=32):
    '''
    Gets the url for the user's avatar
    '''
    if user['avatar'] is None:
        return 'https://cdn.discordapp.com/embed/avatars/{0}.png?size={1}'.format(int(user['discriminator']) % 5, size)
    else:
        return 'https://cdn.discordapp.com/avatars/{0[id]}/{0[avatar]}.png?size={1}'.format(user, size)


def get_guild_icon(guild, size=32):
    '''
    Gets the url for the guild's icon
    '''
    if guild['icon'] is None:
        return 'https://cdn.discordapp.com/embed/avatars/0.png?size={1}'.format(guild, size)
    else:
        return 'https://cdn.discordapp.com/icons/{0[id]}/{0[icon]}.png?size={1}'.format(guild, size)


def get_user(token=None):
    discord = make_session(token=token)
    user = discord.get(API_BASE_URL + '/users/@me').json()
    return user if 'id' in user else None, discord


def get_character():
    '''
    Uses character data and request arguments to select a character

    If successful returns a character
    If unsuccessful calls an abort function
    '''
    if request.method in ['POST', 'PUT', 'DELETE']:
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

    return character, True


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


@app.errorhandler(400)
def four_hundred(e):
    '''
    400 (bad request) error page
    '''
    return error(e, "Bad request."), 400


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
    user, discord = get_user(session.get('oauth2_token'))

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


@app.route('/server_select')
def new_char_server_select():
    '''
    Allows the user to select the server to add a new character to
    '''
    user, discord = get_user(session.get('oauth2_token'))
    if not user:
        abort(403)

    user['avatar'] = get_user_avatar(user)
    characters = db.session.query(m.Character).filter_by(user=user.get('id')).order_by(m.Character.name).all()
    characters = {str(character.server) for character in characters}
    guilds = [guild for guild in discord.get(API_BASE_URL + '/users/@me/guilds').json()
              if guild['id'] not in characters]
    for guild in guilds:
        guild['icon'] = get_guild_icon(guild)

    return render_template(
        'pickserver.html',
        title='New Character',
        user=user,
        guilds=guilds,
    )


@app.route('/new_character')
def new_character():
    '''
    Create a new character
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

    return render_template(
        'new_character.html',
        title='New Character',
        user=user,
        guild=guild,
    )


# ----#-   REST endpoints


@app.route('/constants')
def constants():
    '''
    Returns the current character's constants in json form
    '''
    character, successful = get_character()
    data = table2json(character.constants)
    return jsonify(data)


@app.route('/constants', methods=['POST'])
def addConstant():
    '''
    Adds a constant to the character and returns the new constant
    '''
    character, successful = get_character()
    item = m.Constant(
        character_id=character.id,
        name=request.form.get('name', ''),
        value=int(request.form.get('value', 0)),
    )
    try:
        db.session.add(item)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        abort(409)
    else:
        return jsonify(entry2json(item))


@app.route('/constants', methods=['PUT'])
def updateConstant():
    '''
    Updates a constant, returning the updated item on success
    '''
    id = request.form.get('id')
    if id is None:
        abort(400)
    character, successful = get_character()
    item = db.session.query(m.Constant).filter_by(character_id=character.id, id=id).one()
    for key in ['name', 'value']:
        setattr(item, key, request.form.get(key, getattr(item, key)))

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        abort(409)
    else:
        return jsonify(entry2json(item))


@app.route('/constants', methods=["DELETE"])
def deleteConstant():
    '''
    Deletes a constant from the character and returns success message
    '''
    id = request.form.get('id')
    if id is None:
        abort(400)
    character, successful = get_character()
    item = db.session.query(m.Constant).filter_by(character_id=character.id, id=id).one()
    db.session.delete(item)
    db.session.commit()
    return jsonify({'message': 'successful'})


@app.route('/rolls')
def rolls():
    '''
    Returns the current character's rolls in json form
    '''
    character, successful = get_character()
    data = table2json(character.rolls)
    return jsonify(data)


@app.route('/rolls', methods=['POST'])
def addRoll():
    '''
    Adds a roll to the character and returns the new roll
    '''
    character, successful = get_character()
    item = m.Roll(
        character_id=character.id,
        name=request.form.get('name', ''),
        expression=request.form.get('expression', ''),
    )
    try:
        db.session.add(item)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        abort(409)
    else:
        return jsonify(entry2json(item))


@app.route('/rolls', methods=['PUT'])
def updateRolls():
    '''
    Updates a roll, returning the updated item on success
    '''
    id = request.form.get('id')
    if id is None:
        abort(400)
    character, successful = get_character()
    item = db.session.query(m.Roll).filter_by(character_id=character.id, id=id).one()
    for key in ['name', 'expression']:
        setattr(item, key, request.form.get(key, getattr(item, key)))

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        abort(409)
    else:
        return jsonify(entry2json(item))


@app.route('/rolls', methods=["DELETE"])
def deleteRoll():
    '''
    Deletes a roll from the character and returns success message
    '''
    id = request.form.get('id')
    if id is None:
        abort(400)
    character, successful = get_character()
    item = db.session.query(m.Roll).filter_by(character_id=character.id, id=id).one()
    db.session.delete(item)
    db.session.commit()
    return jsonify({'message': 'successful'})


@app.route('/resources')
def resources():
    '''
    Returns the current character's resources in json form
    '''
    character, successful = get_character()
    data = table2json(character.resources)
    return jsonify(data)


@app.route('/resources', methods=['POST'])
def addResource():
    '''
    Adds a resource to the character and returns the new resource
    '''
    character, successful = get_character()
    item = m.Resource(
        character_id=character.id,
        name=request.form.get('name', ''),
        current=int(request.form.get('current', 0)),
        max=int(request.form.get('max', 0)),
        recover=request.form.get('recover', 'other'),
    )
    try:
        db.session.add(item)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        abort(409)
    else:
        return jsonify(entry2json(item))


@app.route('/resources', methods=['PUT'])
def updateResources():
    '''
    Updates a resource, returning the updated item on success
    '''
    id = request.form.get('id')
    if id is None:
        abort(400)
    character, successful = get_character()
    item = db.session.query(m.Resource).filter_by(character_id=character.id, id=id).one()
    for key in ['name', 'current', 'max', 'recover']:
        setattr(item, key, request.form.get(key, getattr(item, key)))

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        abort(409)
    else:
        return jsonify(entry2json(item))


@app.route('/resources', methods=["DELETE"])
def deleteResource():
    '''
    Deletes a resource from the character and returns success message
    '''
    id = request.form.get('id')
    if id is None:
        abort(400)
    character, successful = get_character()
    item = db.session.query(m.Resource).filter_by(character_id=character.id, id=id).one()
    db.session.delete(item)
    db.session.commit()
    return jsonify({'message': 'successful'})


@app.route('/spells')
def spells():
    '''
    Returns the current character's spells in json form
    '''
    character, successful = get_character()
    data = table2json(character.spells)
    return jsonify(data)


@app.route('/spells', methods=['POST'])
def addSpell():
    '''
    Adds a spell to the character and returns the new spell
    '''
    character, successful = get_character()
    item = m.Spell(
        character_id=character.id,
        name=request.form.get('name', ''),
        level=int(request.form.get('level', 0)),
        description=request.form.get('description', ''),
    )
    try:
        db.session.add(item)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        abort(409)
    else:
        return jsonify(entry2json(item))


@app.route('/spells', methods=['PUT'])
def updateSpell():
    '''
    Updates a spell, returning the updated item on success
    '''
    id = request.form.get('id')
    if id is None:
        abort(400)
    character, successful = get_character()
    item = db.session.query(m.Spell).filter_by(character_id=character.id, id=id).one()
    for key in ['name', 'level', 'description']:
        setattr(item, key, request.form.get(key, getattr(item, key)))

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        abort(409)
    else:
        return jsonify(entry2json(item))


@app.route('/spells', methods=["DELETE"])
def deleteSpell():
    '''
    Deletes a spell from the character and returns success message
    '''
    id = request.form.get('id')
    if id is None:
        abort(400)
    character, successful = get_character()
    item = db.session.query(m.Spell).filter_by(character_id=character.id, id=id).one()
    db.session.delete(item)
    db.session.commit()
    return jsonify({'message': 'successful'})


@app.route('/inventory')
def inventory():
    '''
    Returns the current character's inventory in json form
    '''
    character, successful = get_character()
    data = table2json(character.inventory)
    return jsonify(data)


@app.route('/inventory', methods=['POST'])
def addItem():
    '''
    Adds an item to the character and returns the new item
    '''
    character, successful = get_character()
    item = m.Item(
        character_id=character.id,
        name=request.form.get('name', ''),
        number=int(request.form.get('number', 0)),
        description=request.form.get('description', ''),
    )
    try:
        db.session.add(item)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        abort(409)
    else:
        return jsonify(entry2json(item))


@app.route('/inventory', methods=['PUT'])
def updateItem():
    '''
    Updates an item, returning the updated item on success
    '''
    id = request.form.get('id')
    if id is None:
        abort(400)
    character, successful = get_character()
    item = db.session.query(m.Item).filter_by(character_id=character.id, id=id).one()
    for key in ['name', 'number', 'description']:
        setattr(item, key, request.form.get(key, getattr(item, key)))

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        abort(409)
    else:
        return jsonify(entry2json(item))


@app.route('/inventory', methods=["DELETE"])
def deleteItem():
    '''
    Deletes an item from the character and returns success message
    '''
    id = request.form.get('id')
    if id is None:
        abort(400)
    character, successful = get_character()
    item = db.session.query(m.Item).filter_by(character_id=character.id, id=id).one()
    db.session.delete(item)
    db.session.commit()
    return jsonify({'message': 'successful'})


# ----#-   Login/Logout


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
