class Create extends React.Component {
    constructor(props) {
        super(props)
        this.error = this.error.bind(this)
        this.change = this.change.bind(this)
        this.claim = this.claim.bind(this)
        this.makeTemplate = this.makeTemplate.bind(this)
        this.state = {name: ""}
    }

    error(message, jqXHR) {
        this.props.onError(message, jqXHR)
    }

    change(e) {
        const t = e.target
        this.setState({[t.name]: t.value})
    }

    claim(e) {
        const url = '/api/server/' + this.props.server_id + '/characters'
        const name = this.state.name
        this.addRequest = $.ajax({
            url: url,
            type: 'POST',
            dataType: 'json',
            data: {name: name},
            error: (jqXHR) => {
                if (jqXHR.status == 409) {
                    alert("There is already a character named " + name + " on this server")
                }
                else {
                    this.error("Failed to create character", jqXHR)
                }
            },
            success: (newItem) => window.location = '/character?character=' + newItem.id,
        })
    }

    makeTemplate(edition) {
        const url = '/api/make-character-template/' + edition + '/server/' + this.props.server_id
        const name = this.state.name
        this.addRequest = $.ajax({
            url: url,
            type: 'POST',
            dataType: 'json',
            data: {name: name},
            error: (jqXHR) => {
                if (jqXHR.status == 409) {
                    alert("There is already a character named " + name + " on this server")
                }
                else {
                    this.error("Failed to create character", jqXHR)
                }
            },
            success: (newItem) => window.location = '/character?character=' + newItem.id,
        })
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
                    <div className="input-group-append">
                        <button className="form-control btn btn-success" onClick={this.claim}>Create</button>
                    </div>
                </div>
                <div class="btn-group">
                    <button className="form-control btn btn-success" onClick={() => this.makeTemplate('5e')}>Create 5e template</button>
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
        if (this.request !== undefined) {
            this.request.abort()
        }
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
        if (this.userRequest !== undefined) {
            this.userRequest.abort()
        }
        if (this.serverRequest !== undefined) {
            this.serverRequest.abort()
        }
    }

    render() {
        const user = (this.state.user === undefined) ? <Warning>Loading user...</Warning> : <User user={this.state.user} href="/" />
        const server = (this.state.server === undefined) ? <Warning>Loading server...</Warning> : <Server server={this.state.server} href={"/character-list?server=" + this.state.server.id} />
        const pick = (this.state.user === undefined) ? <Warning>Loading characters...</Warning> : <Pick server_id={this.props.server_id} onError={this.error} />

        return (
            <Container>
                <h1>Character select</h1>
                {server}
                {user}
                <Create server_id={this.props.server_id} onError={this.error} />
                <br />
                {pick}
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