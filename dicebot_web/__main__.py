#!/usr/bin/env python3

import sys
import os
import argparse

from flask import (
    Flask,
    abort,
    redirect,
    render_template,
    request,
    send_from_directory,
    session,
)
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import contains_eager, joinedload, selectinload
from sqlalchemy.orm.exc import NoResultFound, MultipleResultsFound
from flask_sqlalchemy import SQLAlchemy, _QueryProperty
from flask_oauthlib.client import OAuth
import requests

from dicebot import model as m

# Create App
app = Flask(__name__)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
# Attach Database
db = SQLAlchemy(app)
db.Model = m.Base
# Ugly code to make Base.query work
m.Base.query_class = db.Query
m.Base.query = _QueryProperty(db)
# Configure Google OAuth
oauth = OAuth()
google = oauth.remote_app(
    'google',
    app_key='GOOGLE',
    request_token_params={'scope': 'email'},
    base_url='https://www.googleapis.com/oauth2/v1/',
    request_token_url=None,
    access_token_method='POST',
    access_token_url='https://accounts.google.com/o/oauth2/token',
    authorize_url='https://accounts.google.com/o/oauth2/auth',
)


def create_app(args):
    r"""
    Sets up app for use
    Adds database configuration and the secret key
    """
    app.jinja_env.trim_blocks = True
    app.jinja_env.lstrip_blocks = True

    # setup Database
    app.config['SQLALCHEMY_DATABASE_URI'] = args.database
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
        }
        # get Config values from database
        for name in config:
            try:
                key = m.Config.query.filter_by(name=name).one()
                config[name] = key.value
            except NoResultFound:
                key = m.Config(name=name, value=config[name])
                db.session.add(key)
                db.session.commit()

        app.config.update(config)
        app.config['SECRET_KEY'] = app.config['token']


@app.context_processor
def context():
    r"""
    Makes extra variables available to the template engine
    """
    return dict(
        m=m,
        str=str,
        int=get_int,
        date=date,
        len=len,
        markdown=markdown,
        correct_time=correct_time,
    )


def error(e, message):
    r"""
    Basic error template for all error pages
    """
    try:
        user = get_user()
    except:
        user = None

    html = render_template(
        'error.html',
        title=str(e),
        message=message,
        user=user,
    )
    return html


@app.errorhandler(403)
def four_oh_three(e):
    r"""
    403 (forbidden) error page
    """
    return error(e, "You don't have access to this page."), 403


@app.errorhandler(404)
def four_oh_four(e):
    r"""
    404 (page not found) error page
    """
    return error(e, "We couldn't find the page you were looking for."), 404


@app.errorhandler(500)
def five_hundred(e):
    r"""
    500 (internal server) error page
    """
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


def get_user():
    r"""
    Gets the user data from the current session
    Returns the Tutor object of the current user
    """
    email = session.get('username')
    user = None
    if email:
        if app.config['DEBUG']:
            user = m.Tutors(email=email, is_active=True, is_superuser=True)
        else:
            try:
                user = m.Tutors.query.filter_by(email=email).one()
            except NoResultFound:
                session.clear()
                flash('&#10006; User does not exist: {}.'.format(email))

        if user and not user.is_active:
            session.clear()
            flash('&#10006; User is not active: {}.'.format(email))
            user = None
    return user


@app.route('/favicon.ico')
def favicon():
    r"""
    The favorites icon for the site
    """
    return send_from_directory(
        os.path.join(app.root_path, 'static', 'images'),
        'favicon.ico',
        mimetype='image/vnd.microsoft.icon',
    )

# ----#-   Pages


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

    create_app(args)

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
