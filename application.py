from flask_sslify import SSLify

from dicebot_web import app as application

sslify = SSLify(application)
application.config['PREFERRED_URL_SCHEME'] = 'https'

if __name__ == '__main__':
    import os
    application.run(
        host='127.0.0.1',
        port=5000,
        debug=False,
        ssl_context='adhoc',
    )
