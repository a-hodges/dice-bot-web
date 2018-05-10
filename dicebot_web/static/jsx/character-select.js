class Create extends React.Component {
    constructor(props) {
        super(props)
        this.error = this.error.bind(this)
        this.change = this.change.bind(this)
        this.state = {name: ""}
    }

    error(message, jqXHR) {
        if (jqXHR.status == 400) {
            alert("You must give the character a name")
        }
        else if (jqXHR.status == 409) {
            alert("There is already a character named " + this.state.name + " on this server")
        }
        else {
            this.props.onError("Failed to create character", jqXHR)
        }
    }

    change(e) {
        const t = e.target
        this.setState({[t.name]: t.value})
    }

    render() {
        return (
            <div>
                <h2>Create character:</h2>
                <div className="input-group">
                    <div className="input-group-prepend">
                        <span className="input-group-text">name:</span>
                    </div>
                    <input className="form-control" type="text" name="name" value={this.state.name} onChange={this.change} />
                </div>
                <div className="btn-group">
                    <LoadingButton
                        className="form-control btn btn-success"
                        url={'/api/server/' + this.props.server_id + '/characters'}
                        method="POST"
                        data={{name: this.state.name}}
                        callback={(data) => window.location = '/character?character=' + data.id}
                        onError={this.error}>
                        Create (no template)
                    </LoadingButton>
                </div>
                <div className="btn-group">
                    <LoadingButton
                        className="form-control btn btn-success"
                        url={'/api/make-character-template/5e/server/' + this.props.server_id}
                        method="POST"
                        data={{name: this.state.name}}
                        callback={(data) => window.location = '/character?character=' + data.id}
                        onError={this.error}>
                        Create (5e template)
                    </LoadingButton>
                </div>
            </div>
        )
    }
}

class Character extends React.Component {
    constructor(props) {
        super(props)
        this.error = this.error.bind(this)
        this.pick = this.pick.bind(this)
    }

    error(message, jqXHR) {
        this.props.onError(message, jqXHR)
    }

    pick(e) {
        const url = '/api/characters/' + this.props.character.id
        this.addRequest = $.ajax({
            url: url,
            type: 'PATCH',
            dataType: 'json',
            data: {user: '@me'},
            error: (jqXHR) => this.error("Failed to claim character", jqXHR),
            success: (newItem) => window.location = '/character?character=' + newItem.id,
        })
    }

    render() {
        return (
            <li className="list-group-item">
                <button className="btn btn-link" onClick={this.pick}>{this.props.character.name}</button>
            </li>
        )
    }
}

class Pick extends React.Component {
    constructor(props) {
        super(props)
        this.error = this.error.bind(this)
        this.state = {}
    }

    error(message, jqXHR) {
        this.props.onError(message, jqXHR)
    }

    componentDidMount() {
        this.request = $.ajax({
            url: '/api/server/' + this.props.server_id + '/characters',
            type: 'GET',
            dataType: 'json',
            error: (jqXHR) => this.error("Failed to load characters", jqXHR),
            success: (data) => this.setState({list: data.filter((item) => item.user === null)}),
        })
    }

    componentWillUnmount() {
        abortRequest(this.request)
    }

    componentDidCatch(error, info) {
        this.error("Unknown error")
    }

    render() {
        return (this.state.list === undefined)
        ? <Warning>Loading characters...</Warning>
        : (
            <div>
                <h2>Claim character:</h2>
                <ul className="list-group">
                    {this.state.list.map((item) => <Character key={item.id} character={item} onError={this.error} />)}
                </ul>
            </div>
        )
    }
}

class Base extends React.Component {
    constructor(props) {
        super(props)
        this.error = this.error.bind(this)
        this.state = {}
    }

    error(message, jqXHR) {
        this.props.onError(message, jqXHR)
    }

    componentDidMount() {
        this.characterRequest = $.ajax({
            url: 'api/server/' + this.props.server_id + '/characters/@me',
            type: 'GET',
            dataType: 'json',
            error: (jqXHR) => {
                if (jqXHR.status == 401) {
                    this.error("Not logged in", jqXHR)
                }
                else if (jqXHR.status == 404) {
                    // good, the user shouldn't have a character
                }
                else {
                    this.error("Failed to load user", jqXHR)
                }
            },
            success: (data) => this.error("You already have a character, you cannot claim another"),
        })

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
        }
    }

    componentWillUnmount() {
        abortRequest(this.characterRequest)
        abortRequest(this.userRequest)
        abortRequest(this.serverRequest)
    }

    render() {
        const user = (this.state.user === undefined) ? <Warning>Loading user...</Warning> : <User user={this.state.user} href="/" />
        const server = (this.state.server === undefined) ? <Warning>Loading server...</Warning> : <Server server={this.state.server} href={"/character-list?server=" + this.state.server.id} />

        return (
            <Container>
                <h1>Character creation</h1>
                {server}
                {user}
                <Create server_id={this.props.server_id} onError={this.error} />
            </Container>
        )
    }
}

const server = urlparams.get("server")
if (server !== null) {
    ReactDOM.render(
        <ErrorHandler><Base server_id={server} /></ErrorHandler>,
        document.getElementById("root")
    )
}
else {
    ReactDOM.render(
        <Container><Error>Bad request, no server specified</Error></Container>,
        document.getElementById("root")
    )
}
