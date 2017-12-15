class Constants extends React.Component {
    constructor(props) {
        super(props)
        this.state = {data: []}
    }

    componentDidMount() {
        $.ajax({
            url: '/constants',
            method: 'get',
            dataType: 'json',
            data: {
                user: this.props.user_id,
                server: this.props.server_id,
            },
            error: () => this.setState((prevState, props) => ({data: []})),
            success: (data) => this.setState((prevState, props) => ({data: data})),
        })
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
        this.state = {data: []}
    }

    componentDidMount() {
        $.ajax({
            url: '/rolls',
            method: 'get',
            dataType: 'json',
            data: {
                user: this.props.user_id,
                server: this.props.server_id,
            },
            error: () => this.setState((prevState, props) => ({data: []})),
            success: (data) => this.setState((prevState, props) => ({data: data})),
        })
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
        this.state = {data: []}
    }

    componentDidMount() {
        $.ajax({
            url: '/resources',
            method: 'get',
            dataType: 'json',
            data: {
                user: this.props.user_id,
                server: this.props.server_id,
            },
            error: () => this.setState((prevState, props) => ({data: []})),
            success: (data) => this.setState((prevState, props) => ({data: data})),
        })
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
        this.state = {data: []}
    }

    componentDidMount() {
        $.ajax({
            url: '/spells',
            method: 'get',
            dataType: 'json',
            data: {
                user: this.props.user_id,
                server: this.props.server_id,
            },
            error: () => this.setState((prevState, props) => ({data: []})),
            success: (data) => this.setState((prevState, props) => ({data: data})),
        })
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
        this.state = {data: []}
    }

    componentDidMount() {
        $.ajax({
            url: '/inventory',
            method: 'get',
            dataType: 'json',
            data: {
                user: this.props.user_id,
                server: this.props.server_id,
            },
            error: () => this.setState((prevState, props) => ({data: []})),
            success: (data) => this.setState((prevState, props) => ({data: data})),
        })
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
    render() {
        return (
            <div>
                <Constants user_id={this.props.user_id} server_id={this.props.server_id} />
                <Rolls user_id={this.props.user_id} server_id={this.props.server_id} />
                <Resources user_id={this.props.user_id} server_id={this.props.server_id} />
                <Spells user_id={this.props.user_id} server_id={this.props.server_id} />
                <Inventory user_id={this.props.user_id} server_id={this.props.server_id} />
            </div>
        )
    }
}

ReactDOM.render(
    <Character user_id={user_id} server_id={server_id} />,
    document.getElementById("root")
);
