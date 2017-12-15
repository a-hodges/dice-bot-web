class Constants extends React.Component {
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
            url: '/constants',
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

    render() {
        let list = null
        if (this.state.data) {
            list = this.state.data.map((item) => {
                return <li key={item.name}>{item.name}: {item.value}</li>
            })
        }
        return (
            <div>
                <h2>Constants</h2>
                <ul>{list}</ul>
            </div>
        )
    }
}

class Rolls extends React.Component {
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
            url: '/rolls',
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

    render() {
        let list = null
        if (this.state.data) {
            list = this.state.data.map((item) => {
                return <li key={item.name}>{item.name}: {item.expression}</li>
            })
        }
        return (
            <div>
                <h2>Rolls</h2>
                <ul>{list}</ul>
            </div>
        )
    }
}

class Resources extends React.Component {
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
            url: '/resources',
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

    render() {
        let list = null
        if (this.state.data) {
            list = this.state.data.map((item) => {
                return <li key={item.name}>{item.name}: {item.current}/{item.max} {(item.recover != 'other') ? 'per ' + item.recover + ' rest' : null}</li>
            })
        }
        return (
            <div>
                <h2>Resources</h2>
                <ul>{list}</ul>
            </div>
        )
    }
}

class Spells extends React.Component {
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
            url: '/spells',
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

    render() {
        let list = null
        if (this.state.data) {
            list = this.state.data.map((item) => {
                return <li key={item.name}>{item.name} | level {item.level} <br/> {item.description}</li>
            })
        }
        return (
            <div>
                <h2>Spells</h2>
                <ul>{list}</ul>
            </div>
        )
    }
}

class Inventory extends React.Component {
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
            url: '/inventory',
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

    render() {
        let list = null
        if (this.state.data) {
            list = this.state.data.map((item) => {
                return <li key={item.name}>{item.name}: {item.number} <br/> {item.description}</li>
            })
        }
        return (
            <div>
                <h2>Inventory</h2>
                <ul>{list}</ul>
            </div>
        )
    }
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
