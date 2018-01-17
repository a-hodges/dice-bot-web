from flask_sqlalchemy import SQLAlchemy

from dicebot import model as m

db = SQLAlchemy()
db.Model = m.Base
