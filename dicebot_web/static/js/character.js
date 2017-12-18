class Component extends React.Component {
    constructor(props) {
        super(props)
        this.error = this.error.bind(this)
        this.state = {data: []}
    }

    error(message) {
        this.props.onError(message)
    }

    componentDidMount() {
        this.request = $.get({
            url: this.props.url,
            dataType: 'json',
            data: {
                server: this.props.server_id,
            },
            error: () => this.error("Could not load data"),
            success: (data) => this.setState((prevState, props) => ({data: data})),
        })
    }

    componentWillUnmount() {
        this.request.abort()
    }

    render() {
        let list = null
        if (this.state.data) {
            list = this.state.data.map(this.props.lineItem)
        }
        return (
            <div>
                <h2>{this.props.title}</h2>
                <ul>{list}</ul>
            </div>
        )
    }
}

function Constants(props) {
    return <Component
        title="Constants"
        url="/constants"
        lineItem={(item) => <li key={item.id}>{item.name}: {item.value}</li>}
        server_id={props.server_id} onError={props.onError} />
}

function Rolls(props) {
    return <Component
        title="Rolls"
        url="/rolls"
        lineItem={(item) => <li key={item.id}>{item.name}: {item.expression}</li>}
        server_id={props.server_id} onError={props.onError} />
}

function Resources(props) {
    return <Component
        title="Resources"
        url="/resources"
        lineItem={(item) => <li key={item.id}>{item.name}: {item.current}/{item.max} {(item.recover != 'other') ? 'per ' + item.recover + ' rest' : null}</li>}
        server_id={props.server_id} onError={props.onError} />
}

function Spells(props) {
    return <Component
        title="Spells"
        url="/spells"
        lineItem={(item) => <li key={item.id}>{item.name} | level {item.level} <br/> {item.description}</li>}
        server_id={props.server_id} onError={props.onError} />
}

function Inventory(props) {
    return <Component
        title="Inventory"
        url="/inventory"
        lineItem={(item) => <li key={item.id}>{item.name}: {item.number} <br/> {item.description}</li>}
        server_id={props.server_id} onError={props.onError} />
}

function Error(props) {
    return (
        <div>
            <p className="alert alert-danger">{props.message}</p>
        </div>
    )
}

class Character extends React.Component {
    constructor(props) {
        super(props)
        this.error = this.error.bind(this)
        this.state = {error: ""}
    }

    error(message) {
        this.setState((prevState, props) => ({error: message}))
    }

    render() {
        if (this.state.error === "") {
            return (
                <div>
                    <Constants server_id={this.props.server_id} onError={this.error} />
                    <Rolls server_id={this.props.server_id} onError={this.error} />
                    <Resources server_id={this.props.server_id} onError={this.error} />
                    <Spells server_id={this.props.server_id} onError={this.error} />
                    <Inventory server_id={this.props.server_id} onError={this.error} />
                </div>
            )
        }
        else {
            return (
                <Error message={this.state.error} />
            )
        }
    }
}

let urlparams = new URLSearchParams(window.location.search)
ReactDOM.render(
    <Character server_id={urlparams.get("server")} />,
    document.getElementById("root")
)
