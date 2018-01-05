Array.prototype.deleteItem = function(item) {
    const index = this.indexOf(item)
    return this.slice(0,index).concat(this.slice(index+1))
}

Array.prototype.updateItem = function(oldItem, newItem) {
    const index = this.indexOf(oldItem)
    return this.slice(0,index).concat([newItem], this.slice(index+1))
}

function paragraphs(str) {
    if (str) {
        return <p>{str.split("\n").join(<br />)}</p>
    }
    else {
        return ""
    }
}

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
            let list = this.state.data.map((item) => (
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
    return <Group
        title="Constants"
        character_id={props.character_id} onError={props.onError}
        display={(item) => <span>{item.name}: {item.value}</span>}
    />
}

function Rolls(props) {
    return <Group
        title="Rolls"
        character_id={props.character_id} onError={props.onError}
        display={(item) => <span>{item.name}: {item.expression}</span>}
    />
}

function Resources(props) {
    return <Group
        title="Resources"
        character_id={props.character_id} onError={props.onError}
        display={(item) => <span>{item.name}: {item.current}/{item.max} per {item.recover} rest</span>}
    />
}

function Spells(props) {
    return <Group
        title="Spells"
        character_id={props.character_id} onError={props.onError}
        display={(item) => (
            <div>
                <span>{item.name} | level: {item.level}</span>
                {paragraphs(item.description)}
            </div>
        )}
    />
}

function Inventory(props) {
    return <Group
        title="Inventory"
        character_id={props.character_id} onError={props.onError}
        display={(item) => (
            <div>
                <span>{item.name} | quantity: {item.number}</span>
                {paragraphs(item.description)}
            </div>
        )}
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
