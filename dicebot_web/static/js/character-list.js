class Character extends React.Component {
    constructor(props) {
        super(props)
        this.error = this.error.bind(this)
        this.state = {}
    }

    error(message, jqXHR) {
        this.props.onError(message, jqXHR)
    }

    componentDidMount() {
        if (this.props.character.user !== null) {
            this.request = $.ajax({
                url: '/api/user/' + this.props.character.user,
                type: 'GET',
                dataType: 'json',
                data: {server: this.props.character.server},
                error: (jqXHR) => this.onError("Could not load character", jqXHR),
                success: (data) => this.setState({user: data}),
            })
        }
    }

    componentWillUnmount() {
        if (this.request !== undefined) {
            this.request.abort()
        }
    }

    render() {
        let character
        if (this.props.character.user === null) {
            character = <span>{this.props.character.name}</span>
        }
        else if (this.state.user === undefined) {
            character = <Warning>Loading user...</Warning>
        }
        else {
            character = <span>{this.props.character.name} | <User user={this.state.user} inline={true} link={false} /></span>
        }

        return <li className="list-group-item">
            <a href={'/character?character=' + this.props.character.id}>
                {character}
            </a>
        </li>
    }
}

class List extends React.Component {
    constructor(props) {
        super(props)
        this.error = this.error.bind(this)
        this.state = {}
    }

    error(message, jqXHR) {
        this.setState({error: message})
    }

    componentDidMount() {
        this.listRequest = $.ajax({
            url: '/api/server/' + this.props.server_id + '/characters',
            type: 'GET',
            dataType: 'json',
            error: () => this.error("Could not load character"),
            success: (data) => this.setState({list: data}),
        })
        this.serverRequest = $.ajax({
            url: '/api/server/' + this.props.server_id,
            type: 'GET',
            dataType: 'json',
            error: () => this.error("Could not load server"),
            success: (data) => this.setState({server: data}),
        })
        this.userRequest = $.ajax({
            url: '/api/user/@me',
            type: 'GET',
            dataType: 'json',
            data: {server: this.props.server_id},
            error: () => this.error("Could not load user"),
            success: (data) => this.setState({user: data}),
        })
    }

    componentWillUnmount() {
        if (this.listRequest !== undefined) {
            this.listRequest.abort()
        }
        if (this.userRequest !== undefined) {
            this.userRequest.abort()
        }
        if (this.serverRequest !== undefined) {
            this.serverRequest.abort()
        }
    }

    componentDidCatch(error, info) {
        this.error("Unknown error")
    }

    render() {
        let body
        if (this.state.error === undefined) {
            const user = (this.state.user === undefined) ? <Warning>Loading user...</Warning> : <User user={this.state.user} link={true} />
            const server = (this.state.server === undefined) ? <Warning>Loading server...</Warning> : <Server server={this.state.server} link={true} />
            const list = (this.state.list === undefined) ? <Warning>Loading server...</Warning> : <ul className="list-group">
                {this.state.list.map((item) => <Character character={item} onError={this.error} />)}
            </ul>

            body = <div>
                <h1>Server:</h1>
                {server}
                {user}
                <h2>View character:</h2>
                {list}
            </div>
        }
        else {
            body = <Error>{this.state.error}</Error>
        }
        return <div className="container">{body}</div>
    }
}

const server = urlparams.get("server")
ReactDOM.render(
    <List server_id={server} />,
    document.getElementById("root")
)