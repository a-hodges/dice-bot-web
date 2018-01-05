function Error(props) {
    return (
        <p className="alert alert-danger">{props.children}</p>
    )
}

function Warning(props) {
    return (
        <p className="alert alert-warning">{props.children}</p>
    )
}

class Group extends React.Component {
    constructor(props) {
        super(props)
        this.criticalError = this.criticalError.bind(this)
        this.state = {data: undefined}
        this.slug = this.props.title.replace(" ", "_").toLowerCase()
    }

    criticalError(message) {
        this.props.onError(message)
    }

    componentDidMount() {
        const url = '/' + this.slug
        this.request = $.ajax({
            url: url,
            type: 'GET',
            dataType: 'json',
            data: {
                character: this.props.character_id,
            },
            error: () => this.criticalError("Could not load data"),
            success: (data) => this.setState({data: data}),
        })
    }

    componentWillUnmount() {
        if (this.request !== undefined) {
            this.request.abort()
        }
    }

    render() {
        let body
        if (this.state.data !== undefined) {
            const list = this.state.data.map((item) => (
                <li key={item.id} className="list-group-item d-flex justify-content-between align-items-center">
                    {this.props.display(item)}
                </li>
            ))
            body = (
                <ul className="list-group">
                    {list}
                </ul>
            )
        }
        else {
            body = <Warning>Loading...</Warning>
        }
        return (
            <div>
                <h2>{this.props.title}</h2>
                {body}
            </div>
        )
    }
}

function Constants(props) {
    const display = (item) => <span>{item.name}: {item.value}</span>
    return <Group
        title="Constants"
        character_id={props.character_id} onError={props.onError}
        display={display}
    />
}

function Rolls(props) {
    const display = (item) => <span>{item.name}: {item.expression}</span>
    return <Group
        title="Rolls"
        character_id={props.character_id} onError={props.onError}
        display={display}
    />
}

function Resources(props) {
    const display = (item) => <span>{item.name}: {item.current}/{item.max} per {item.recover} rest</span>
    return <Group
        title="Resources"
        character_id={props.character_id} onError={props.onError}
        display={display}
    />
}

function lines(str) {
    if (str) {
        return str.split("\n").map((item, i) => <span key={i}><br /> {item}</span>)
    }
    else {
        return ""
    }
}

function Spells(props) {
    const display = (item) => (
        <div>
            <span>{item.name} | level: {item.level}</span>
            {lines(item.description)}
        </div>
    )
    return <Group
        title="Spells"
        character_id={props.character_id} onError={props.onError}
        display={display}
    />
}

function Inventory(props) {
    const display = (item) => (
        <div>
            <span>{item.name} | quantity: {item.number}</span>
            {lines(item.description)}
        </div>
    )
    return <Group
        title="Inventory"
        character_id={props.character_id} onError={props.onError}
        display={display}
    />
}

class Character extends React.Component {
    constructor(props) {
        super(props)
        this.error = this.error.bind(this)
        this.state = {error: ""}
    }

    error(message) {
        this.setState({error: message})
    }

    componentDidCatch(error, info) {
        this.error("Unknown error")
    }

    render() {
        if (this.state.error === "") {
            return (
                <div>
                    <Constants character_id={this.props.character_id} onError={this.error} />
                    <Rolls character_id={this.props.character_id} onError={this.error} />
                    <Resources character_id={this.props.character_id} onError={this.error} />
                    <Spells character_id={this.props.character_id} onError={this.error} />
                    <Inventory character_id={this.props.character_id} onError={this.error} />
                </div>
            )
        }
        else {
            return (
                <Error>{this.state.error}</Error>
            )
        }
    }
}

const urlparams = new URLSearchParams(window.location.search)
const character = urlparams.get("character")
ReactDOM.render(
    <Character character_id={character} />,
    document.getElementById("root")
)
