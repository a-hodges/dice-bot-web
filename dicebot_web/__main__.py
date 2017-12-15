#!/usr/bin/env python3

import os
import argparse

from flask import (
    Flask,
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
from flask_sqlalchemy import SQLAlchemy, _QueryProperty
from flask_oauthlib.client import OAuth
from werkzeug import security

from dicebot import model as m

# Create App
app = Flask(__name__)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
# Attach Database
db = SQLAlchemy(app)
db.Model = m.Base
# Configure Discord OAuth
oauth = OAuth(app)
app.discord = oauth.remote_app(
    'discord',
    app_key='DISCORD',
    request_token_params={'scope': 'identify'},
    base_url='https://discordapp.com/api/oauth2/',
    request_token_url=None,
    access_token_method='POST',
    access_token_url='https://discordapp.com/api/oauth2/token',
    authorize_url='https://discordapp.com/api/oauth2/authorize',
)


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
            'DISCORD_CONSUMER_KEY': None,
            'DISCORD_CONSUMER_SECRET': None,
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
    content = '<h1>Dice-bot</h1>'
    user = False

    if session.get('id'):
        content += '<p>Id: {}</p>'.format(session['id'])
        user = True

    return render_template(
        'base.html',
        title='Dice-Bot',
        user=user,
        content='<h1>Dice-bot</h1>',
    )


# ----#-   Login/Logout


@app.discord.tokengetter
def get_token(token=None):
    '''
    Returns a user's token from OAuth
    '''
    return session.get('token')


@app.route('/login/')
def login():
    '''
    Redirects the user to the Discord Single Sign On page
    '''
    session.clear()
    next = request.args.get('next') or request.referrer or None
    html = app.discord.authorize(
        callback=url_for('oauth_authorized', _external=True),
        state=next,
    )
    return html


@app.route('/oauth-authorized')
def oauth_authorized():
    '''
    Logs the user in using the OAuth API
    '''
    next_url = request.args.get('state') or url_for('index')

    resp = app.discord.authorized_response()
    if resp is None:
        return redirect(next_url)

    session['token'] = (resp['access_token'], '')

    resp = app.discord.get(
        'users/@me',
        token=session['token'][0],
        data={'fields': 'id'},
    )
    print(resp.data)

    ...

    return redirect(next_url)


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

    app.run(
        host='0.0.0.0',
        port=args.port,
        debug=args.debug,
        use_reloader=args.reload,
    )


if __name__ == '__main__':
    main()
