class Component extends React.Component {
    title = 'Item'
    url = '/404'

    constructor(props) {
        super(props)
        this.error = this.error.bind(this);
        this.state = {data: []}
    }

    error(message) {
        this.props.onError(message)
    }

    componentDidMount() {
        this.request = $.get({
            url: this.url,
            dataType: 'json',
            data: {
                user: this.props.user_id,
                server: this.props.server_id,
            },
            error: () => this.error("Could not load data"),
            success: (data) => this.setState((prevState, props) => ({data: data})),
        })
    }

    componentWillUnmount() {
        this.request.abort()
    }

    lineItem = (item) => <li key={item.name}>{item.name}</li>

    render() {
        let list = null
        if (this.state.data) {
            list = this.state.data.map(this.lineItem)
        }
        return (
            <div>
                <h2>{this.title}</h2>
                <ul>{list}</ul>
            </div>
        )
    }
}

class Constants extends Component {
    title = 'Constants'
    url = '/constants'

    lineItem = (item) => <li key={item.name}>{item.name}: {item.value}</li>
}

class Rolls extends React.Component {
    title = 'Rolls'
    url = '/rolls'

    lineItem = (item) => <li key={item.name}>{item.name}: {item.expression}</li>
}

class Resources extends React.Component {
    title = 'Resources'
    url = '/resources'

    lineItem = (item) => <li key={item.name}>{item.name}: {item.current}/{item.max} {(item.recover != 'other') ? 'per ' + item.recover + ' rest' : null}</li>
}

class Spells extends React.Component {
    title = 'Spells'
    url = '/spells'

    lineItem = (item) => <li key={item.name}>{item.name} | level {item.level} <br/> {item.description}</li>
}

class Inventory extends React.Component {
    title = 'Inventory'
    url = '/inventory'

    lineItem = (item) => <li key={item.name}>{item.name}: {item.number} <br/> {item.description}</li>
}

class Character extends React.Component {
    constructor(props) {
        super(props)
        this.error = this.error.bind(this);
        this.state = {error: ""}
    }

    error(message) {
        this.setState((prevState, props) => ({error: message}))
    }

    render() {
        if (this.state.error === "") {
            return (
                <div>
                    <Constants user_id={this.props.user_id} server_id={this.props.server_id} onError={this.error} />
                    <Rolls user_id={this.props.user_id} server_id={this.props.server_id} onError={this.error} />
                    <Resources user_id={this.props.user_id} server_id={this.props.server_id} onError={this.error} />
                    <Spells user_id={this.props.user_id} server_id={this.props.server_id} onError={this.error} />
                    <Inventory user_id={this.props.user_id} server_id={this.props.server_id} onError={this.error} />
                </div>
            )
        }
        else {
            return (
                <div>
                    <p className="alert alert-danger">{this.state.error }</p>
                </div>
            )
        }
    }
}

ReactDOM.render(
    <Character user_id={user_id} server_id={server_id} />,
    document.getElementById("root")
);
