import enum

from flask import Blueprint, session
from flask_restful import Api, Resource, reqparse, abort
from sqlalchemy.exc import IntegrityError

from .util import API_BASE_URL, get_user, user_in_guild, bot_get, table2json, entry2json
from .database import db, m

api_bp = Blueprint('api', __name__)
api = Api(api_bp)


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
        abort(403)

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
    def get(self):
        user, discord = get_user(session.get('oauth2_token'))
        if not user:
            abort(403)
        return User().get(user['id'])


@api.resource('/server/<int:server_id>')
class Server (Resource):
    def get(self, server_id):
        server_id = str(server_id)
        user, discord = get_user(session.get('oauth2_token'))
        if not user or not user_in_guild(server_id, user['id']):
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
        if not user or not user_in_guild(server_id, user['id']):
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
        user, discord = get_user(session.get('oauth2_token'))
        if not user or not user_in_guild(server_id, user['id']):
            abort(403)
        character = m.Character(name=args['name'], user=user['id'], server=server_id)
        db.session.add(character)
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            abort(409)
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
        character = db.session.query(m.Character).get(character_id)
        if not user or not character:
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
