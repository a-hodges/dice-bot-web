#!/usr/bin/env python3

import os
import datetime

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
from sqlalchemy.orm.exc import NoResultFound

from .util import AUTHORIZATION_BASE_URL, TOKEN_URL, get_user, make_session
from .database import db, m
from .restful import api_bp

# Create App
app = Flask(__name__)
app.jinja_env.trim_blocks = True
app.jinja_env.lstrip_blocks = True
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_DATABASE_URI'] = None
# Attach Database and REST
db.init_app(app)
app.register_blueprint(api_bp, url_prefix='/api')


# ----#-   Application


def create_app(database):
    '''
    Sets up app for use
    Adds database configuration and the secret key
    '''
    if database is not None and database != app.config['SQLALCHEMY_DATABASE_URI']:
        # setup Database
        app.config['SQLALCHEMY_DATABASE_URI'] = database

        # setup config values
        with app.app_context():
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
            app.config.update(config)
            app.config['PERMANENT_SESSION_LIFETIME'] = \
                datetime.timedelta(int(app.config['PERMANENT_SESSION_LIFETIME']))
            app.secret_key = app.config['token']


@app.before_request
def make_session_permanent():
    session.permanent = True


@app.context_processor
def context():
    '''
    Makes extra variables available to the template engine
    '''
    return dict(AUTHORIZATION_BASE_URL=AUTHORIZATION_BASE_URL)


# ----#-   Errors


def error(e, message=None):
    '''
    Basic error template for all error pages
    '''
    user, discord = get_user(session.get('oauth2_token'))
    html = render_template(
        'error.html',
        user=user,
        title=str(e),
        message=message,
    )
    return html


@app.errorhandler(400)
def four_hundred(e):
    '''
    400 (bad request) error page
    '''
    return error(e), 400


@app.errorhandler(403)
def four_oh_three(e):
    '''
    403 (forbidden) error page
    '''
    return error(e), 403


@app.errorhandler(404)
def four_oh_four(e):
    '''
    404 (page not found) error page
    '''
    return error(e), 404


@app.errorhandler(500)
def five_hundred(e):
    '''
    500 (internal server) error page
    '''
    message = '500 Internal Server Error: Whoops, looks like something went wrong!'
    return error(message), 500


@app.route('/error/<int:error>')
def doError(error):
    '''
    For testing purposes, allows easy testing of error messages
    '''
    abort(error)


# ----#-   Pages


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


@app.route('/node_modules/<path:filename>')
def node_modules(filename):
    return send_from_directory(os.path.join(app.root_path, '..', 'node_modules'), filename)


views = {
    '/': ['index.js'],
    '/character': ['character.js'],
    '/character-list': ['character-list.js'],
    '/character-select': ['character-select.js'],
}


@app.route('/')
def index():
    '''
    Homepage for the bot
    '''
    return react_view(views['/'])


def react_view(scripts):
    '''
    Renders a template with the given react scripts loaded
    '''
    user, discord = get_user(session.get('oauth2_token'))
    return render_template('react.html', user=user, scripts=scripts)


for rule, scripts in views.items():
    app.add_url_rule(rule, view_func=react_view, defaults={'scripts': scripts})


# ----#-   Login/Logout


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

create_app(os.environ.get('DB', None))  # default database setup
