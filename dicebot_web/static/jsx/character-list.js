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
        if (this.props.character.user !== null && this.props.character.user !== "DM") {
            this.request = $.ajax({
                url: '/api/user/' + this.props.character.user,
                type: 'GET',
                dataType: 'json',
                data: {server: this.props.character.server},
                error: (jqXHR) => this.onError("Failed to load user", jqXHR),
                success: (data) => this.setState({user: data}),
            })
        }
    }

    componentWillUnmount() {
        abortRequest(this.request)
    }

    render() {
        let character
        if (this.props.character.user === null) {
            character = <span>{this.props.character.name}</span>
        }
        else if (this.props.character.user === "DM") {
            character = <span>{this.props.character.name}: DM</span>
        }
        else if (this.state.user === undefined) {
            return <li className="list-group-item list-group-item-warning">Loading user...</li>
        }
        else {
            character = <span>{this.props.character.name}: <User user={this.state.user} inline={true} hidePrefix={true} /></span>
        }

        return (
            <li className="list-group-item">
                <a href={'/character?character=' + this.props.character.id}>
                    {character}
                </a>
            </li>
        )
    }
}

class List extends React.Component {
    constructor(props) {
        super(props)
        this.error = this.error.bind(this)
        this.state = {}
    }

    error(message, jqXHR) {
        this.props.onError(message, jqXHR)
    }

    componentDidMount() {
        this.userRequest = $.ajax({
            url: '/api/user/@me',
            type: 'GET',
            dataType: 'json',
            data: {server: this.props.server_id},
            error: (jqXHR) => {
                if (jqXHR.status == 401) {
                    this.error("Not logged in", jqXHR)
                }
                else {
                    this.error("Failed to load user", jqXHR)
                }
            },
            success: (data) => this.setState({user: data}, loadMore),
        })
        const loadMore = () => {
            this.serverRequest = $.ajax({
                url: '/api/server/' + this.props.server_id,
                type: 'GET',
                dataType: 'json',
                error: (jqXHR) => this.error("Failed to load server", jqXHR),
                success: (data) => this.setState({server: data}, () => document.title = this.state.server.name),
            })
            this.listRequest = $.ajax({
                url: '/api/server/' + this.props.server_id + '/characters',
                type: 'GET',
                dataType: 'json',
                error: (jqXHR) => this.error("Failed to load characters", jqXHR),
                success: (data) => this.setState({list: data}),
            })
        }
    }

    componentWillUnmount() {
        abortRequest(this.listRequest)
        abortRequest(this.userRequest)
        abortRequest(this.serverRequest)
    }

    render() {
        const user = (this.state.user === undefined) ? <Warning>Loading user...</Warning> : <User user={this.state.user} href="/" />
        const server = (this.state.server === undefined) ? <Warning>Loading server...</Warning> : <Server server={this.state.server} inline={true} hidePrefix={true} iconSize={64} />
        const list = (this.state.list === undefined)
        ? <Warning>Loading characters...</Warning>
        : (
            <ul className="list-group">
                {this.state.list.map((item) => <Character key={item.id} character={item} onError={this.error} />)}
            </ul>
        )

        return (
            <Container>
                <h1>{server}</h1>
                {user}
                <h2>View character:</h2>
                {list}
            </Container>
        )
    }
}

const server = urlparams.get("server")
if (server !== null) {
    ReactDOM.render(
        <ErrorHandler><List server_id={server} /></ErrorHandler>,
        document.getElementById("root")
    )
}
else {
    ReactDOM.render(
        <Container><Error>Bad request, no server specified</Error></Container>,
        document.getElementById("root")
    )
}
