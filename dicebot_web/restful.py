import enum
from operator import itemgetter

from flask import Blueprint, session
from flask_restful import Api, Resource, reqparse, abort
from sqlalchemy.exc import IntegrityError

from .util import API_BASE_URL, get_user, user_get, user_in_guild, bot_get, bot_in_guild
from .database import db, m

api_bp = Blueprint('api', __name__)
api = Api(api_bp)


def entry2json(entry):
    entry = entry.dict()
    for key, value in entry.items():
        if isinstance(value, enum.Enum):
            entry[key] = value.name
    return entry


def table2json(table):
    data = [entry2json(item) for item in table]
    return data


def prep_cast(cast):
    if isinstance(cast, enum.EnumMeta):
        def cast2(value):
            return cast[value]
        return cast2
    return cast


def get_character(character_id, secure=True):
    '''
    Uses character_id to select a character

    If successful returns a character
    If unsuccessful calls an abort function
    '''
    user, discord = get_user(session.get('oauth2_token'))
    if user is None:
        abort(401)

    character = db.session.query(m.Character).get(character_id)
    if not character:
        abort(403)

    character = character.dict()
    character['own'] = character['user'] == user['id']

    if secure:
        # ensure that the user owns the character
        if not character['own']:
            abort(403)
    else:
        # ensure that the user is in the same guild
        if not user_in_guild(character['server'], user['id']):
            abort(403)

    return character


@api.resource('/user/<int:user_id>')
class User (Resource):
    def get(self, user_id):
        # add security?
        user_id = str(user_id)
        parser = reqparse.RequestParser()
        parser.add_argument('server', help='ID of a server the user is in, if relevant')
        args = parser.parse_args()

        user = None
        if args.server is None:
            resp = bot_get(API_BASE_URL + '/users/' + user_id)
            user = resp.json()
        else:
            resp = bot_get(API_BASE_URL + '/guilds/' + args.server + '/members/' + user_id)
            if resp:
                member = resp.json()
                user = member.pop('user')
                user.update(member)

        if not resp:
            abort(resp.status_code)
        return user


@api.resource('/user/@me')
class Me (Resource):
    '''
    Proxy to get the user object without needing an ID
    '''
    def __init__(self, *args, **kwargs):
        self.args = args
        self.kwargs = kwargs

    def get(self):
        user, discord = get_user(session.get('oauth2_token'))
        if user is None:
            abort(401)
        return User(*self.args, **self.kwargs).get(user['id'])


@api.resource('/user/@me/servers')
class MyServers (Resource):
    def get(self):
        user, discord = get_user(session.get('oauth2_token'))
        if user is None:
            abort(401)
        guilds = user_get(discord, API_BASE_URL + '/users/@me/guilds').json()
        guilds = filter(bot_in_guild, guilds)
        guilds = sorted(guilds, key=itemgetter('name'))
        return list(guilds)


@api.resource('/server/<int:server_id>')
class Server (Resource):
    def get(self, server_id):
        server_id = str(server_id)
        user, discord = get_user(session.get('oauth2_token'))
        if user is None:
            abort(401)
        if not user_in_guild(server_id, user['id']):
            abort(403)
        server = bot_get(API_BASE_URL + '/guilds/' + server_id)
        if not server:
            abort(server.status_code)
        return server.json()


@api.resource('/server/<int:server_id>/characters')
class CharacterList (Resource):
    def get(self, server_id):
        server_id = str(server_id)
        user, discord = get_user(session.get('oauth2_token'))
        if user is None:
            abort(401)
        if not user_in_guild(server_id, user['id']):
            abort(403)
        characters = db.session.query(m.Character)\
            .filter_by(server=server_id)\
            .order_by(m.Character.name).all()
        return table2json(characters)

    def post(self, server_id):
        server_id = str(server_id)
        parser = reqparse.RequestParser()
        parser.add_argument('name', required=True, help='Name of the character')
        args = parser.parse_args()
        if not args.name:
            abort(400)
        user, discord = get_user(session.get('oauth2_token'))
        if user is None:
            abort(401)
        if not user_in_guild(server_id, user['id']):
            abort(403)
        character = m.Character(name=args['name'], user=user['id'], server=server_id)
        db.session.add(character)
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            abort(409)
        return entry2json(character)


@api.resource('/server/<int:server_id>/characters/@me')
class MyCharacter (Resource):
    def get(self, server_id):
        server_id = str(server_id)
        user, discord = get_user(session.get('oauth2_token'))
        if user is None:
            abort(401)
        if not user_in_guild(server_id, user['id']):
            abort(403)
        character = db.session.query(m.Character)\
            .filter_by(server=server_id, user=user['id']).one_or_none()
        if not character:
            abort(404)
        return entry2json(character)


@api.resource('/characters/<int:character_id>')
class Characters (Resource):
    def get(self, character_id):
        character = get_character(character_id, secure=False)
        return character

    def patch(self, character_id):
        parser = reqparse.RequestParser()
        parser.add_argument('name', help='Name of the character')
        parser.add_argument('user', help='"@me" to claim character, "null" to unclaim')
        args = parser.parse_args()
        user, discord = get_user(session.get('oauth2_token'))
        if user is None:
            abort(401)
        character = db.session.query(m.Character).get(character_id)
        if not character:
            abort(403)

        # change name
        if args['name']:
            if character.user != user['id']:
                abort(403)
            character.name = args['name']

        # claim/unclaim
        if args['user']:
            if args['user'] == 'null':  # unclaim
                # restrict to character claimed by the current user on the same server
                if character.user != user['id'] or not user_in_guild(character.server, user['id']):
                    abort(403)
                character.user = None
            elif args['user'] == '@me':  # claim
                # restrict to unclaimed characters on the same server
                if character.user is not None or not user_in_guild(character.server, user['id']):
                    abort(403)
                character.user = user['id']
            else:
                abort(400)

        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            abort(409)
        return entry2json(character)


class CharacterResource (Resource):
    def __init__(self, type, fields):
        self.type = type
        self.fields = fields

    def get(self, character_id, item_id):
        character = get_character(character_id, secure=False)
        data = db.session.query(self.type)\
            .filter_by(character_id=character['id'], id=item_id).one_or_none()
        if not data:
            abort(404)
        return entry2json(data)

    def patch(self, character_id, item_id):
        parser = reqparse.RequestParser()
        for field, cast in self.fields.items():
            if field != 'id':
                parser.add_argument(field, type=prep_cast(cast), store_missing=False)
        args = parser.parse_args()
        character = get_character(character_id, secure=True)
        item = db.session.query(self.type)\
            .filter_by(character_id=character['id'], id=item_id).one_or_none()
        if item is None:
            abort(404)

        for field in self.fields.keys():
            if field != 'id' and field in args:
                setattr(item, field, args[field])

        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            abort(409)
        return entry2json(item)

    def delete(self, character_id, item_id):
        character = get_character(character_id, secure=True)
        item = db.session.query(self.type)\
            .filter_by(character_id=character['id'], id=item_id).one_or_none()
        if item is not None:
            db.session.delete(item)
            db.session.commit()
        return {'message': 'successful'}


class CharacterResourceList (Resource):
    def __init__(self, type, order, fields):
        self.type = type
        self.order = order
        self.fields = fields

    def get(self, character_id):
        character = get_character(character_id, secure=False)
        data = db.session.query(self.type)\
            .filter_by(character_id=character['id'])
        if isinstance(self.order, str):
            data = data.order_by(self.order)
        else:
            data = data.order_by(*self.order)
        data = data.all()
        return table2json(data)

    def post(self, character_id):
        parser = reqparse.RequestParser()
        for field, cast in self.fields.items():
            if field != 'id':
                parser.add_argument(field, type=prep_cast(cast))
        args = parser.parse_args()
        character = get_character(character_id, secure=True)
        item = self.type(character_id=character['id'])
        for field in self.fields.keys():
            if field != 'id' and args[field] is not None:
                setattr(item, field, args[field])

        db.session.add(item)
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            abort(409)
        else:
            return entry2json(item)


def add_character_resource(api, short_name, name, type, order, fields):
    api.add_resource(
        CharacterResource,
        '/characters/<int:character_id>/{}/<int:item_id>'.format(name),
        resource_class_kwargs={'type': type, 'fields': fields},
        endpoint=short_name)

    api.add_resource(
        CharacterResourceList,
        '/characters/<int:character_id>/{}'.format(name),
        resource_class_kwargs={'type': type, 'order': order, 'fields': fields},
        endpoint=name)


information_fields = {'name': str, 'description': str}
add_character_resource(api, 'info', 'information', m.Information, 'name', information_fields)

variable_fields = {'name': str, 'value': int}
add_character_resource(api, 'variable', 'variables', m.Variable, 'name', variable_fields)

roll_fields = {'name': str, 'expression': str}
add_character_resource(api, 'roll', 'rolls', m.Roll, 'name', roll_fields)

resource_fields = {'name': str, 'current': int, 'max': int, 'recover': m.Rest}
add_character_resource(api, 'resource', 'resources', m.Resource, 'name', resource_fields)

spell_fields = {'name': str, 'level': int, 'description': str}
add_character_resource(api, 'spell', 'spells', m.Spell, ('level', 'name'), spell_fields)

item_fields = {'name': str, 'number': int, 'description': str}
add_character_resource(api, 'item', 'inventory', m.Item, 'name', item_fields)


# ----#-   Extras


stats_5e = {
    'cha': 10,
    'con': 10,
    'dex': 10,
    'int': 10,
    'prof': 2,
    'str': 10,
    'wis': 10,
}

skills_5e = {
    'acrobatics': 'dex',
    'animal handling': 'wis',
    'arcana': 'int',
    'athletics': 'str',
    'chasave': 'cha',
    'consave': 'con',
    'deception': 'cha',
    'dexsave': 'dex',
    'history': 'int',
    'insight': 'wis',
    'intimidation': 'cha',
    'intsave': 'int',
    'investigation': 'int',
    'medicine': 'wis',
    'nature': 'int',
    'perception': 'wis',
    'performance': 'cha',
    'persuasion': 'cha',
    'religion': 'int',
    'sleight of hand': 'dex',
    'stealth': 'dex',
    'strsave': 'str',
    'survival': 'wis',
    'wissave': 'wis',
}

instructions_5e = '''
Information:
The information section contains information about your character such as a description and features
Any text blocks can be stored here for any reason
It is recommended that you prefix information names with something like `Feature: ` to group them

Variables:
The variables section hold the numeric attributes of your character such as strength or proficiency bonus
Some defaults have been filled in, be sure to change them to reflect your character
Variables can only have whole number values, anything else will cause an error

Rolls:
The rolls section stores dice calculations to be used by the bot
These rolls can use variables so that stored rolls don't have to change when your stats do
The special `!` operator calculates the modifier for a stat, see the examples or bot help for more info

Some defaults are included, notably all of the skills and saves are included with no proficiencies
To add proficiency to a roll simply add `+prof` to the end of the skill or save
`+prof//2` can be used to add half proficiency (rounded down) or `+prof*2` for double proficiency

Additionally, rolls can be used for more than just dice rolling, any calculated value can be stored
e.x. `8+!int+prof` gives the spell dave DC for a wizard, or `14+(!dex<2)` gives your AC in scale mail

Resources:
Resources track any limited use skills or resources like HP and spell slots
`long rest` resources recover during a long rest
`short rest` resources recover during a short or long rest
`other rest` resources must be recovered manually (magic item uses often go here)
Resources can go above max or below 0, but must be whole number values

Spells:
The spell section contains information about spells
Cantrips are considered level 0

Inventory:
The inventory section contains information about the items you carry
This includes their quantity and an optional description
'''.strip()


@api.resource('/make-character-template-5e/server/<int:server_id>')
class MakeCharacterTemplate5e (Resource):
    def post(self, server_id):
        server_id = str(server_id)
        parser = reqparse.RequestParser()
        parser.add_argument('name', required=True, help='Name of the character')
        args = parser.parse_args()
        if not args.name:
            abort(400)
        # authenticate user
        user, discord = get_user(session.get('oauth2_token'))
        if user is None:
            abort(401)
        if not user_in_guild(server_id, user['id']):
            abort(403)
        # create character
        character = m.Character(name=args['name'], user=user['id'], server=server_id)
        db.session.add(character)
        # add children
        for stat, value in stats_5e.items():
            character.variables.append(m.Variable(name=stat, value=value))
        for skill, stat in skills_5e.items():
            character.rolls.append(m.Roll(name=skill, expression='1d20+!{}'.format(stat)))
        character.rolls.append(m.Roll(name='attack', expression='1d20+!str'))
        character.rolls.append(m.Roll(name='quarterstaff', expression='1d8+!str'))
        character.resources.append(m.Resource(name='hp', max=8, current=8, recover=m.Rest.long))
        character.resources.append(m.Resource(name='temp hp', max=0, current=0, recover=m.Rest.long))
        character.information.append(m.Information(name='instructions', description=instructions_5e))
        # commit
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            abort(409)
        # return
        return entry2json(character)
