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
        const name = prompt("Please enter the name of the new item:", "")
        if (!name) {return}
        const url = '/' + this.slug
        this.addRequest = $.ajax({
            url: url,
            type: 'POST',
            dataType: 'json',
            data: {
                character: this.props.character_id,
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

    updateItem(item, ...updated) {
        const url = '/' + this.slug
        const data = {character: this.props.character_id, id: item.id}
        updated.map(key => data[key] = item[key])
        this.updateRequest = $.ajax({
            url: url,
            type: 'PATCH',
            dataType: 'json',
            data: data,
            error: (jqXHR) => {
                if (jqXHR.status == 404) {
                    this.setState((prevState, props) => ({data: prevState.data.filter((i) => i.id != item.id)}))
                }
                else if (jqXHR.status == 409) {
                    alert("There is already an item in " + this.props.title + " with the given name")
                }
                else {
                    this.criticalError("Failed to update item")
                }
            },
            success: (newItem) => this.setState((prevState, props) => ({data: prevState.data.map((item) => (item.id == newItem.id) ? newItem : item)})),
        })
    }

    deleteItem(id) {
        const url = '/' + this.slug
        this.deleteRequest = $.ajax({
            url: url,
            type: 'DELETE',
            dataType: 'json',
            data: {
                character: this.props.character_id,
                id: id,
            },
            error: () => this.criticalError("Failed to remove item"),
            success: () => this.setState((prevState, props) => ({data: prevState.data.filter((item) => item.id != id)})),
        })
    }

    render() {
        let body
        if (this.state.data !== undefined) {
            const list = this.state.data.map((item) => (
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
    }

    updateItem(e) {
        const name = e.target.name
        if (this.props.item[name] != e.target.value) {
            this.props.updateItem(Object.assign(this.props.item, {[name]: e.target.value}), name)
        }
    }

    deleteItem(e) {
        this.props.deleteItem(this.props.item.id)
    }

    render() {
        return (
            <li className="list-group-item d-flex justify-content-between align-items-center">
                {this.props.display(this.props.item, this.updateItem)}
                <button className="btn btn-danger badge badge-danger badge-pill" onClick={this.deleteItem}>Delete</button>
            </li>
        )
    }
}

function Constants(props) {
    const display = (item, updateItem) => (
        <div className="input-group">
            <div className="input-group-prepend">
                <span className="input-group-text">{item.name}:</span>
            </div>
            <input className="form-control" type="number" name="value" defaultValue={item.value} onBlur={updateItem} />
        </div>
    )
    return <Group
        title="Constants"
        character_id={props.character_id} onError={props.onError}
        display={display}
    />
}

function Rolls(props) {
    const display = (item, updateItem) => (
        <div className="input-group">
            <div className="input-group-prepend">
                <span className="input-group-text">{item.name}:</span>
            </div>
            <input className="form-control" type="text" name="expression" defaultValue={item.expression} onBlur={updateItem} />
        </div>
    )
    return <Group
        title="Rolls"
        character_id={props.character_id} onError={props.onError}
        display={display}
    />
}

function Resources(props) {
    const display = (item, updateItem) => (
        <div className="input-group">
            <div className="input-group-prepend">
                <span className="input-group-text">{item.name}:</span>
            </div>
            <input className="form-control" type="number" name="current" defaultValue={item.current} onBlur={updateItem} />
            <span className="input-group-text">/</span>
            <input className="form-control" type="number" name="max" defaultValue={item.max} onBlur={updateItem} />
            <span className="input-group-text">per</span>
            <select className="form-control" name="recover" defaultValue={item.recover} onChange={updateItem}>
                <option value="short">short rest</option>
                <option value="long">long rest</option>
                <option value="other">other</option>
            </select>
        </div>
    )
    return <Group
        title="Resources"
        character_id={props.character_id} onError={props.onError}
        display={display}
    />
}

function Spells(props) {
    const display = (item, updateItem) => (
        <div className="w-100">
            <div className="input-group">
                <div className="input-group-prepend">
                    <span className="input-group-text">{item.name}</span>
                    <span className="input-group-text">level:</span>
                </div>
                <input className="form-control" type="number" name="level" defaultValue={item.level} onBlur={updateItem} />
            </div>
            <textarea className="form-control" name="description" defaultValue={item.description || ''} onBlur={updateItem} />
        </div>
    )
    return <Group
        title="Spells"
        character_id={props.character_id} onError={props.onError}
        display={display}
    />
}

function Inventory(props) {
    const display = (item, updateItem) => (
        <div className="w-100">
            <div className="input-group">
                <div className="input-group-prepend">
                    <span className="input-group-text">{item.name}</span>
                    <span className="input-group-text">quantity:</span>
                </div>
                <input className="form-control" type="number" name="number" defaultValue={item.number} onBlur={updateItem} />
            </div>
            <textarea className="form-control" name="description" defaultValue={item.description || ''} onBlur={updateItem} />
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
                    <br />
                    <div><a className="btn btn-danger" href={"/unclaim?character=" + this.props.character_id}>Unclaim character</a></div>
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
