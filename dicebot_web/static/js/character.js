Array.prototype.deleteItem = function(item) {
    const index = this.indexOf(item)
    return this.slice(0,index).concat(this.slice(index+1))
}

Array.prototype.updateItem = function(oldItem, newItem) {
    const index = this.indexOf(oldItem)
    return this.slice(0,index).concat([newItem], this.slice(index+1))
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
        this.addItem = this.addItem.bind(this)
        this.updateItem = this.updateItem.bind(this)
        this.deleteItem = this.deleteItem.bind(this)
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
        if (this.updateRequest !== undefined) {
            this.updateRequest.abort()
        }
        if (this.deleteRequest !== undefined) {
            this.deleteRequest.abort()
        }
    }

    addItem() {
        let name = prompt("Please enter the name of the new item:", "")
        if (!name) {return}
        const url = '/' + this.slug
        this.addRequest = $.ajax({
            url: url,
            type: 'POST',
            dataType: 'json',
            data: {
                server: this.props.server_id,
                name: name,
            },
            error: (jqXHR) => {
                if (jqXHR.status == 409) {
                    alert("There is already an item in " + this.props.title + " with the given name")
                }
                else {
                    this.criticalError("Failed to add item")
                }
            },
            success: (newItem) => this.setState((prevState, props) => ({data: prevState.data.concat([newItem])})),
        })
    }

    updateItem(item, updated) {
        const url = '/' + this.slug
        const data = {server: this.props.server_id, id: item.id}
        updated.map(key => data[key] = item[key])
        this.updateRequest = $.ajax({
            url: url,
            type: 'PATCH',
            dataType: 'json',
            data: data,
            error: (jqXHR) => {
                if (jqXHR.status == 409) {
                    alert("There is already an item in " + this.props.title + " with the given name")
                }
                else {
                    this.criticalError("Failed to update item")
                }
            },
            // success: (newItem) => this.setState((prevState, props) => ({data: prevState.data.updateItem(item, newItem)})),
        })
    }

    deleteItem(item) {
        const url = '/' + this.slug
        this.deleteRequest = $.ajax({
            url: url,
            type: 'DELETE',
            dataType: 'json',
            data: {
                server: this.props.server_id,
                id: item.id,
            },
            error: () => this.criticalError("Failed to remove item"),
            success: () => this.setState((prevState, props) => ({data: prevState.data.deleteItem(item)})),
        })
    }

    render() {
        let body
        if (this.state.data !== undefined) {
            let list = this.state.data.map((item) => (
                <GroupItem key={item.id} updateItem={this.updateItem} deleteItem={this.deleteItem} display={this.props.display} item={item} />
            ))
            body = (
                <ul className="list-group">
                    {list}
                    <li className="list-group-item"><button className="btn btn-secondary w-100" onClick={this.addItem}>+ New</button></li>
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

class GroupItem extends React.Component {
    constructor(props) {
        super(props)
        this.updateItem = this.updateItem.bind(this)
        this.deleteItem = this.deleteItem.bind(this)
        this.state = props.item
    }

    updateItem(e) {
        this.setState({[e.target.name]: e.target.value})
    }

    componentDidUpdate(prevProps, prevState) {
        const changed = Object.keys(this.state).filter(key => this.state[key] !== prevState[key])
        this.props.updateItem(this.state, changed)
    }

    deleteItem(e) {
        this.props.deleteItem(this.state)
    }

    render() {
        return (
            <li className="list-group-item d-flex justify-content-between align-items-center">
                {this.props.display(this.state, this.updateItem)}
                <button className="btn btn-danger badge badge-danger badge-pill" onClick={this.deleteItem}>Delete</button>
            </li>
        )
    }
}

function Constants(props) {
    return <Group
        title="Constants"
        server_id={props.server_id} onError={props.onError}
        display={(item, updateItem) => (
            <div className="input-group">
                <div className="input-group-prepend">
                    <span className="input-group-text">{item.name}:</span>
                </div>
                <input className="form-control" type="number" name="value" value={item.value} onChange={updateItem} />
            </div>
        )}
    />
}

function Rolls(props) {
    return <Group
        title="Rolls"
        server_id={props.server_id} onError={props.onError}
        display={(item, updateItem) => (
            <div className="input-group">
                <div className="input-group-prepend">
                    <span className="input-group-text">{item.name}:</span>
                </div>
                <input className="form-control" type="text" name="expression" value={item.expression} onChange={updateItem} />
            </div>
        )}
    />
}

function Resources(props) {
    return <Group
        title="Resources"
        server_id={props.server_id} onError={props.onError}
        display={(item, updateItem) => (
            <div className="input-group">
                <div className="input-group-prepend">
                    <span className="input-group-text">{item.name}:</span>
                </div>
                <input className="form-control" type="number" name="current" value={item.current} onChange={updateItem} />
                <span className="input-group-text">/</span>
                <input className="form-control" type="number" name="max" value={item.max} onChange={updateItem} />
                <span className="input-group-text">per</span>
                <select className="form-control" name="recover" value={item.recover} onChange={updateItem}>
                    <option value="short">short rest</option>
                    <option value="long">long rest</option>
                    <option value="other">other</option>
                </select>
            </div>
        )}
    />
}

function Spells(props) {
    return <Group
        title="Spells"
        server_id={props.server_id} onError={props.onError}
        display={(item, updateItem) => (
            <div className="w-100">
                <div className="input-group">
                    <div className="input-group-prepend">
                        <span className="input-group-text">{item.name}</span>
                        <span className="input-group-text">level:</span>
                    </div>
                    <input className="form-control" type="number" name="level" value={item.level} onChange={updateItem} />
                </div>
                <textarea className="form-control" name="description" value={item.description} onChange={updateItem} />
            </div>
        )}
    />
}

function Inventory(props) {
    return <Group
        title="Inventory"
        server_id={props.server_id} onError={props.onError}
        display={(item, updateItem) => (
            <div className="w-100">
                <div className="input-group">
                    <div className="input-group-prepend">
                        <span className="input-group-text">{item.name}</span>
                        <span className="input-group-text">quantity:</span>
                    </div>
                    <input className="form-control" type="number" name="number" value={item.number} onChange={updateItem} />
                </div>
                <textarea className="form-control" name="description" value={item.description} onChange={updateItem} />
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
                <Error>{this.state.error}</Error>
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
