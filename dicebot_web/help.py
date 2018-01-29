from flask import Blueprint, abort, session, render_template

import dicebot
from .util import get_user

help_bp = Blueprint('help', __name__)


def sort_commands(commands):
    def sort_by(command):
        return (hasattr(command, 'commands'), command.name)
    return sorted(commands, key=sort_by)


def command_path(command):
    return command.qualified_name.replace(' ', '/')


@help_bp.route('/')
def index():
    '''
    Homepage for the commands list
    '''
    user, discord = get_user(session.get('oauth2_token'))

    return render_template(
        'commands_index.html',
        user=user,
        bot=dicebot.bot,
        sorted=sort_commands,
        command_path=command_path,
    )


@help_bp.route('/<path:command>')
def command(command):
    '''
    The help text for a command
    '''
    user, discord = get_user(session.get('oauth2_token'))
    command = command.replace('/', ' ')
    command = dicebot.bot.get_command(command)
    if not command:
        abort(404)
    return render_template(
        'command.html',
        user=user,
        bot=dicebot.bot,
        command=command,
        sorted=sort_commands,
        command_path=command_path,
    )
