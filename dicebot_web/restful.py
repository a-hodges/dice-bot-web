import enum

from flask import Blueprint, session
from flask_restful import Api, Resource, reqparse, abort
from sqlalchemy.exc import IntegrityError

from .util import API_BASE_URL, get_user, user_in_guild, bot_get, table2json, entry2json
from .database import db, m

api_bp = Blueprint('api', __name__)
api = Api(api_bp)


class User (Resource):
    def get(self):
        parser = reqparse.RequestParser()
        parser.add_argument('user', required=True, help='ID for the user')
        args = parser.parse_args()
        user = bot_get(API_BASE_URL + '/users/' + args.user)
        if user.status_code >= 300:
            abort(user.status_code)
        return user.json()


api.add_resource(User, '/user')


class Server (Resource):
    def get(self):
        parser = reqparse.RequestParser()
        parser.add_argument('server', required=True, help='ID for the server')
        args = parser.parse_args()
        server = bot_get(API_BASE_URL + '/guilds/' + args.server)
        if server.status_code >= 300:
            abort(server.status_code)
        return server.json()


api.add_resource(Server, '/server')


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


class Characters (Resource):
    def get(self, character_id):
        character = get_character(character_id, secure=False)
        return character

    def patch(self, character_id):
        parser = reqparse.RequestParser()
        parser.add_argument('name', help='Name of the character')
        args = parser.parse_args()
        user, discord = get_user(session.get('oauth2_token'))
        character = db.session.query(m.Character).get(character_id)
        if not character or character.user != user['id']:
            abort(403)
        if args['name']:
            character.name = args['name']
        try:
            session.commit()
        except IntegrityError:
            session.rollback()
            abort(409)
        return character.dict()


api.add_resource(Characters, '/character/<int:character_id>')


class CharacterResourceList (Resource):
    def __init__(self, type, order):
        self.type = type
        self.order = order

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


api.add_resource(
    CharacterResourceList,
    '/character/<int:character_id>/information',
    resource_class_kwargs={'type': m.Information, 'order': 'name'},
    endpoint='information')


api.add_resource(
    CharacterResourceList,
    '/character/<int:character_id>/variables',
    resource_class_kwargs={'type': m.Variable, 'order': 'name'},
    endpoint='variables')

api.add_resource(
    CharacterResourceList,
    '/character/<int:character_id>/rolls',
    resource_class_kwargs={'type': m.Roll, 'order': 'name'},
    endpoint='rolls')

api.add_resource(
    CharacterResourceList,
    '/character/<int:character_id>/resources',
    resource_class_kwargs={'type': m.Resource, 'order': 'name'},
    endpoint='resources')

api.add_resource(
    CharacterResourceList,
    '/character/<int:character_id>/spells',
    resource_class_kwargs={'type': m.Spell, 'order': ('level', 'name')},
    endpoint='spells')

api.add_resource(
    CharacterResourceList,
    '/character/<int:character_id>/inventory',
    resource_class_kwargs={'type': m.Item, 'order': 'name'},
    endpoint='inventory')


class CharacterResource (Resource):
    defaults = {
        int: 0,
        str: '',
        m.Rest: m.Rest.other,
    }

    def do_cast(self, cast):
        if isinstance(cast, enum.EnumMeta):
            def cast2(value):
                return cast[value]
            return cast2
        return cast

    def get(self):
        parser = reqparse.RequestParser()
        parser.add_argument('character', type=int, required=True, help='ID for the character')
        args = parser.parse_args()
        character = get_character(args['character'], secure=False)
        data = db.session.query(self.type)\
            .filter_by(character_id=character['id'])
        if isinstance(self.order, str):
            data = data.order_by(self.order)
        else:
            data = data.order_by(*self.order)
        data = data.all()
        return table2json(data)

    def post(self):
        parser = reqparse.RequestParser()
        parser.add_argument('character', type=int, required=True, help='ID for the character')
        for field, cast in self.fields.items():
            if field != 'id':
                parser.add_argument(field, type=self.do_cast(cast), default=self.defaults[cast])
        args = parser.parse_args()
        character = get_character(args['character'], secure=True)
        item = self.type(character_id=character['id'])
        for field in self.fields.keys():
            if field != 'id':
                setattr(item, field, args[field])

        try:
            db.session.add(item)
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            abort(409)
        else:
            return entry2json(item)

    def patch(self):
        parser = reqparse.RequestParser()
        parser.add_argument('character', type=int, required=True, help='ID for the character')
        parser.add_argument('id', type=int, required=True, help='ID for the resource')
        for field, cast in self.fields.items():
            if field != 'id':
                parser.add_argument(field, type=self.do_cast(cast), store_missing=False)
        args = parser.parse_args()
        character = get_character(args['character'], secure=True)
        item = db.session.query(self.type).filter_by(character_id=character['id'], id=args['id']).one_or_none()
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

    def delete(self):
        parser = reqparse.RequestParser()
        parser.add_argument('character', type=int, required=True, help='ID for the character')
        parser.add_argument('id', type=int, required=True, help='ID for the resource')
        args = parser.parse_args()
        character = get_character(args['character'], secure=True)
        item = db.session.query(self.type).filter_by(character_id=character['id'], id=args['id']).one_or_none()
        if item is not None:
            db.session.delete(item)
            db.session.commit()
        return {'message': 'successful'}


class Variable (CharacterResource):
    type = m.Variable
    order = 'name'
    fields = {
        'name': str,
        'value': int,
    }


api.add_resource(Variable, '/variables')


class Roll (CharacterResource):
    type = m.Roll
    order = 'name'
    fields = {
        'name': str,
        'expression': str,
    }


api.add_resource(Roll, '/rolls')


class Resource (CharacterResource):
    type = m.Resource
    order = 'name'
    fields = {
        'name': str,
        'current': int,
        'max': int,
        'recover': m.Rest,
    }


api.add_resource(Resource, '/resources')


class Spell (CharacterResource):
    type = m.Spell
    order = ('level', 'name')  # 'level,name'
    fields = {
        'name': str,
        'level': int,
        'description': str,
    }


api.add_resource(Spell, '/spells')


class Item (CharacterResource):
    type = m.Item
    order = 'name'
    fields = {
        'name': str,
        'number': int,
        'description': str,
    }


api.add_resource(Item, '/inventory')


class Information (CharacterResource):
    type = m.Information
    order = 'name'
    fields = {
        'name': str,
        'description': str,
    }


api.add_resource(Information, '/information', endpoint='info')
