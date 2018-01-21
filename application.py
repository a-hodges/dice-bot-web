from flask_sslify import SSLify

from dicebot_web import app as application

sslify = SSLify(application)

if __name__ == '__main__':
    import os
    import argparse

    port = int(os.environ.get('PORT', 80))  # default port
    parser = argparse.ArgumentParser(
        description='Tutoring Portal Server',
        epilog='The server runs locally on port %d if PORT is not specified.'
        % port)
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

    if args.reload:
        application.config['TEMPLATES_AUTO_RELOAD'] = True

    ssl_context = None if args.debug else 'adhoc'

    application.run(
        host='0.0.0.0',
        port=args.port,
        debug=args.debug,
        use_reloader=args.reload,
        ssl_context=ssl_context,
    )
