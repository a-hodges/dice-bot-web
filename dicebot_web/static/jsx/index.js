function CharacterServer(props) {
    let body
    if (props.character === undefined) {
        return <li className="list-group-item list-group-item-warning">Loading character...</li>
    }
    else if (props.character === null) {
        body = <Server server={props.server} inline={true} hidePrefix={true} href={"/character-list?server=" + props.server.id} />
    }
    else {
        body = <a href={"/character?character=" + props.character.id}><Server server={props.server} inline={true} hidePrefix={true} /> | {props.character.name}</a>
    }

    const list = <a className="badge badge-info badge-pill" href={"/character-list?server=" + props.server.id}>view other characters</a>

    return (
        <li className="list-group-item d-flex justify-content-between align-items-center">
            {body}
            {(props.character !== null) ? list : null}
        </li>
    )
}

class Home extends React.Component {
    constructor(props) {
        super(props)
        this.error = this.error.bind(this)
        this.state = {characters: {}}
        this.requests = []
    }

    error(message, jqXHR) {
        this.props.onError(message, jqXHR)
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
                error: () => this.error("Failed to load servers"),
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
                        this.error("Failed to load server", jqXHR)
                    }
                },
                success: (data) => this.setState((prevState, props) => ({characters: {[item.id]: data, ...prevState.characters}})),
            }))
        }
    }

    componentWillUnmount() {
        abortRequest(this.request)
        abortRequest(this.serverRequest)
        this.requests.map(abortRequest)
    }

    render() {
        let body
        if (this.state.user != null) {
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

            body = (
                <div>
                    <h1><User user={this.state.user} hidePrefix={true} iconSize={64} /></h1>
                    <h2>Characters:</h2>
                    <ul className="list-group">{characters}</ul>
                    <h2>Available servers:</h2>
                    <ul className="list-group">{servers}</ul>
                </div>
            )
        }
        /* else not logged in */
        return (
            <Container>
                <h1>Dice-bot</h1>
                {body}
            </Container>
        )
    }
}

ReactDOM.render(
    <ErrorHandler><Home /></ErrorHandler>,
    document.getElementById("root")
)
