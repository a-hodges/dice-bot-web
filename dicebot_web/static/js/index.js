function CharacterServer(props) {
    let body
    if (props.character === undefined) {
        return <li className="list-group-item list-group-item-warning">Loading character...</li>
    }
    else if (props.character === null) {
        body = <Server server={props.server} inline={true} hidePrefix={true} href={"/pick_character?server=" + props.server.id} />
    }
    else {
        body = <a href={"/character?character=" + props.character.id}><Server server={props.server} inline={true} hidePrefix={true} /> | {props.character.name}</a>
    }
    return <li className="list-group-item d-flex justify-content-between align-items-center">
        {body}
        <a className="badge badge-info badge-pill" href={"/list_characters?server=" + props.server.id}>view characters</a>
    </li>
}

class Home extends React.Component {
    constructor(props) {
        super(props)
        this.error = this.error.bind(this)
        this.state = {error: [], characters: {}}
        this.requests = []
    }

    error(message, jqXHR) {
        this.setState((prevState, props) => ({error: [verboseError(message, jqXHR)].concat(prevState.error)}))
    }

    componentDidMount() {
        this.request = $.ajax({
            url: '/api/user/@me',
            type: 'GET',
            dataType: 'json',
            error: (jqXHR) => {
                if (jqXHR.status == 401) {
                    this.setState({user: null})
                }
                else {
                    this.error("Failed to load user", jqXHR)
                }
            },
            success: (data) => this.setState({user: data}, loadMore),
        })
        const loadMore = () => {
            this.serverRequest = $.ajax({
                url: '/api/user/@me/servers',
                type: 'GET',
                dataType: 'json',
                error: () => this.error("Could not load servers"),
                success: (data) => this.setState({servers: data}, evenMore),
            })
        }
        const evenMore = () => {
            this.requests = this.state.servers.map((item) => $.ajax({
                url: '/api/server/' + item.id + '/characters/@me',
                type: 'GET',
                dataType: 'json',
                error: (jqXHR) => {
                    if (jqXHR.status == 404) {
                        this.setState((prevState, props) => ({characters: {[item.id]: null, ...prevState.characters}}))
                    }
                    else {
                        this.error("Failed to load user", jqXHR)
                    }
                },
                success: (data) => this.setState((prevState, props) => ({characters: {[item.id]: data, ...prevState.characters}})),
            }))
        }
    }

    componentWillUnmount() {
        if (this.request !== undefined) {
            this.request.abort()
        }
        if (this.serverRequest !== undefined) {
            this.serverRequest.abort()
        }
        this.requests.map((item) => {
            if (item !== undefined) {
                item.abort()
            }
        })
    }

    componentDidCatch(error, info) {
        this.error("Unknown error")
    }

    render() {
        let body
        if (this.state.error.length === 0 && this.state.user != null) {
            let characters
            let servers
            if (this.state.servers === undefined) {
                characters = <Warning>Loading servers...</Warning>
                servers = <Warning>Loading servers...</Warning>
            }
            else {
                const toServer = (item) => <CharacterServer key={item.id} server={item} character={this.state.characters[item.id]} />
                const serverList = this.state.servers.map(toServer)
                characters = serverList.filter((item) => item.props.character)
                servers = serverList.filter((item) => !item.props.character)
            }

            body = <div>
                <User user={this.state.user} />
                <h2>Characters:</h2>
                <ul className="list-group">{characters}</ul>
                <h2>Available servers:</h2>
                <ul className="list-group">{servers}</ul>
            </div>
        }
        else if (this.state.error.length === 0) {
            /* Not logged in */
        }
        else {
            body = <div>{this.state.error.map((item) => <Error>{item}</Error>)}</div>
        }
        return <div className="container">
            <h1>Dice-bot</h1>
            {body}
        </div>
    }
}

ReactDOM.render(
    <Home />,
    document.getElementById("root")
)
