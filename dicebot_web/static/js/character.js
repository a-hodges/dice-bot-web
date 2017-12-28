function deleteIndex(arr, index) {
    return arr.slice(0,index).concat(arr.slice(index+1))
}

class Group extends React.Component {
    constructor(props) {
        super(props)
        this.criticalError = this.criticalError.bind(this)
        this.addItem = this.addItem.bind(this)
        this.deleteItem = this.deleteItem.bind(this)
        this.state = {data: []}
        this.slug = this.props.title.replace(" ", "_").toLowerCase()
    }

    criticalError(message) {
        this.props.onError(message)
    }

    componentDidMount() {
        const url = '/' + this.slug
        this.request = $.get({
            url: url,
            dataType: 'json',
            data: {
                server: this.props.server_id,
            },
            error: () => this.criticalError("Could not load data"),
            success: (data) => this.setState({data: data}),
        })
    }

    componentWillUnmount() {
        if (this.request !== undefined) {
            this.request.abort()
        }
        if (this.addRequest !== undefined) {
            this.addRequest.abort()
        }
        if (this.deleteRequest !== undefined) {
            this.deleteRequest.abort()
        }
    }

    addItem() {
        let name = prompt("Please enter the name of the new item:", "")
        const url = '/' + this.slug
        this.addRequest = $.ajax({
            url: url,
            type: 'PUT',
            dataType: 'json',
            data: {
                server: this.props.server_id,
                name: name,
            },
            error: (jqXHR) => {
                if (jqXHR.status == 500) {
                    alert("There is already an item in " + this.props.title + " with the given name")
                }
                else {
                    this.criticalError("Failed to add item")
                }
            },
            success: (newItem) => this.setState((prevState, props) => ({data: prevState.data.concat([newItem])})),
        })
    }

    deleteItem(item) {
        const url = '/' + this.slug + '/' + item.id
        this.deleteRequest = $.ajax({
            url: url,
            type: 'DELETE',
            dataType: 'json',
            data: {
                server: this.props.server_id,
            },
            error: (jqXHR) => {
                if (jqXHR.status == 500) {
                    alert("Item could not be removed")
                }
                else {
                    this.criticalError("Failed to remove item")
                }
            },
            success: () => this.setState((prevState, props) => {
                const index = prevState.data.indexOf(item)
                return {data: deleteIndex(prevState.data, index)}
            }),
        })
    }

    render() {
        let list = null
        if (this.state.data) {
            list = this.state.data.map((item) => this.props.lineItem(item, this.updateItem, this.deleteItem))
        }
        return (
            <div>
                <h2>{this.props.title}</h2>
                <ul className="list-group">
                    {list}
                    <li className="list-group-item"><button className="btn btn-secondary w-100" onClick={this.addItem}>+ New</button></li>
                </ul>
            </div>
        )
    }
}

function Constants(props) {
    return <Group
        title="Constants"
        lineItem={(item, updateItem, deleteItem) => <Constant key={item.id} item={item} deleteItem={deleteItem} />}
        server_id={props.server_id} onError={props.onError} />
}

class Constant extends React.Component {
    constructor(props) {
        super(props)
        this.deleteItem = this.deleteItem.bind(this)
    }

    deleteItem(e) {
        e.preventDefault()
        this.props.deleteItem(this.props.item)
    }

    render() {
        return (
            <li className="list-group-item d-flex justify-content-between align-items-center">
                {this.props.item.name}: {this.props.item.value}
                <button className="btn btn-danger badge badge-danger badge-pill" onClick={this.deleteItem}>Delete</button>
            </li>
        )
    }
}

function Rolls(props) {
    return <Group
        title="Rolls"
        lineItem={(item) => <li key={item.id} className="list-group-item">{item.name}: {item.expression}</li>}
        server_id={props.server_id} onError={props.onError} />
}

function Resources(props) {
    return <Group
        title="Resources"
        lineItem={(item) => <li key={item.id} className="list-group-item">{item.name}: {item.current}/{item.max} {(item.recover != 'other') ? 'per ' + item.recover + ' rest' : null}</li>}
        server_id={props.server_id} onError={props.onError} />
}

function Spells(props) {
    return <Group
        title="Spells"
        lineItem={(item) => <li key={item.id} className="list-group-item">{item.name} | level {item.level} <br/> {item.description}</li>}
        server_id={props.server_id} onError={props.onError} />
}

function Inventory(props) {
    return <Group
        title="Inventory"
        lineItem={(item) => <li key={item.id} className="list-group-item">{item.name}: {item.number} <br/> {item.description}</li>}
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
        this.setState({error: message})
    }

    componentDidCatch(error, info) {
        this.error("Unknown error")
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

const urlparams = new URLSearchParams(window.location.search)
const server = urlparams.get("server")
ReactDOM.render(
    <Character server_id={server} />,
    document.getElementById("root")
)
