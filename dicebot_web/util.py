import os
import enum
import time

import requests
from flask import current_app, session, url_for
from requests_oauthlib import OAuth2Session

# Configure Discord OAuth
API_BASE_URL = 'https://discordapp.com/api'
AUTHORIZATION_BASE_URL = API_BASE_URL + '/oauth2/authorize'
TOKEN_URL = API_BASE_URL + '/oauth2/token'
os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = 'true'  # possibly insecure


def token_updater(token):
    session['oauth_token'] = token


def make_session(token=None, state=None, scope=None):
    client_id = current_app.config['discord_client_id']
    client_secret = current_app.config['discord_client_secret']
    callback = url_for('callback', _external=True)
    if not current_app.config['DEBUG']:
        callback = callback.replace('http://', 'https://')
    return OAuth2Session(
        client_id=client_id,
        token=token,
        state=state,
        scope=scope,
        redirect_uri=callback,
        auto_refresh_kwargs={
            'client_id': client_id,
            'client_secret': client_secret,
        },
        auto_refresh_url=TOKEN_URL,
        token_updater=token_updater,
    )


def get_user(token=None):
    discord = make_session(token=token)
    user = user_get(discord, API_BASE_URL + '/users/@me').json()
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


def user_get(discord, url):
    '''
    A get request authenticated by the user token
    Handles rate limiting
    '''
    response = discord.get(url)
    while response.status_code == 429:
        ms = response.json().get('retry_after', 1000) + 5
        time.sleep(ms / 1000)
        response = discord.get(url)
    return response


def bot_get(url):
    '''
    A get request authenticated by the bot
    Handles rate limiting
    '''
    response = requests.get(url, headers={'Authorization': 'Bot ' + current_app.config['token']})
    while response.status_code == 429:
        ms = response.json().get('retry_after', 1000) + 5
        time.sleep(ms / 1000)
        response = requests.get(url, headers={'Authorization': 'Bot ' + current_app.config['token']})
    return response


def user_in_guild(guild, user):
    '''
    Returns whether the given user is in the given guild
    Both guild and user should be the respective IDs
    '''
    member = bot_get(API_BASE_URL + '/guilds/{}/members/{}'.format(guild, user))
    return bool(member)


def bot_in_guild(guild):
    '''
    Returns whether the bot is in the given guild
    The guild should be a dict as returned by discord Guild resources
    '''
    guild = bot_get(API_BASE_URL + '/guilds/{}'.format(guild.get('id')))
    return bool(guild)
