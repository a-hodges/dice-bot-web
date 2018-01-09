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
        const url = '/rest/' + this.slug
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
        const url = '/rest/' + this.slug
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
        const url = '/rest/' + this.slug
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
        const url = '/rest/' + this.slug
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
                <GroupItem key={item.id} updateItem={this.updateItem} deleteItem={this.deleteItem} editDisplay={this.props.editDisplay} readDisplay={this.props.readDisplay} readOnly={this.props.readOnly} item={item} />
            ))
            const addItem = (this.props.readOnly) ? "" : <li className="list-group-item"><button className="btn btn-secondary w-100" onClick={this.addItem}>+ New</button></li>
            body = (
                <ul className="list-group">
                    {list}
                    {addItem}
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
        this.setRef = this.setRef.bind(this)
        this.editItem = this.editItem.bind(this)
        this.cancel = this.cancel.bind(this)
        this.updateItem = this.updateItem.bind(this)
        this.deleteItem = this.deleteItem.bind(this)
        this.state = {edit: false, refs: []}
    }

    setRef(target) {
        this.state.refs.push(target)
    }

    editItem(e) {
        this.setState({edit: true, refs: []})
    }

    cancel() {
        this.setState({edit: false, refs: []})
    }

    updateItem(e) {
        const keys = this.state.refs.map((item) => item.name)
        const data = {}
        this.state.refs.forEach((item) => data[item.name] = item.value)
        this.props.updateItem(Object.assign({}, this.props.item, data), ...keys)
        this.cancel()
    }

    deleteItem(e) {
        this.props.deleteItem(this.props.item.id)
    }

    render() {
        if (this.state.edit) {
            return (
                <li className="list-group-item d-flex justify-content-between align-items-center">
                    {this.props.editDisplay(this.props.item, this.setRef)}
                    <div className="d-flex flex-column">
                        <button className="btn btn-success badge badge-success badge-pill m-1" onClick={this.updateItem}>save</button>
                        <button className="btn btn-warning badge badge-warning badge-pill m-1" onClick={this.cancel}>cancel</button>
                        <button className="btn btn-danger badge badge-danger badge-pill m-1" onClick={this.deleteItem}>delete</button>
                    </div>
                </li>
            )
        }
        else {
            const edit = (this.props.readOnly) ? "" : <button className="btn btn-info badge badge-info badge-pill m-1" onClick={this.editItem}>edit</button>
            return (
                <li className="list-group-item d-flex justify-content-between align-items-center">
                    {this.props.readDisplay(this.props.item)}
                    {edit}
                </li>
            )
        }
    }
}

function Information(props) {
    const display = (item, setRef) => (
        <div className="w-100">
            <div className="input-group">
                <div className="input-group-prepend">
                    <span className="input-group-text">name:</span>
                </div>
                <input className="form-control" type="text" name="name" defaultValue={item.name} ref={setRef} />
            </div>
            <textarea className="form-control" name="description" defaultValue={item.description || ''} ref={setRef} />
        </div>
    )
    const readDisplay = (item) => (
        <div className="w-100 form-group">
            <span>{item.name}</span>
            <textarea className="form-control" name="description" value={item.description} readOnly={true} />
        </div>
    )
    return <Group
        title="Information"
        editDisplay={display} readDisplay={readDisplay}
        {...props}
    />
}

function Variables(props) {
    const display = (item, setRef) => (
        <div className="w-100">
            <div className="input-group">
                <div className="input-group-prepend">
                    <span className="input-group-text">name:</span>
                </div>
                <input className="form-control" type="text" name="name" defaultValue={item.name} ref={setRef} />
            </div>
            <div className="input-group">
                <div className="input-group-prepend">
                    <span className="input-group-text">value:</span>
                </div>
                <input className="form-control" type="number" name="value" defaultValue={item.value} ref={setRef} />
            </div>
        </div>
    )
    const readDisplay = (item) => <span>{item.name}: {item.value}</span>
    return <Group
        title="Variables"
        editDisplay={display} readDisplay={readDisplay}
        {...props}
    />
}

function Rolls(props) {
    const display = (item, setRef) => (
        <div className="w-100">
            <div className="input-group">
                <div className="input-group-prepend">
                    <span className="input-group-text">name:</span>
                </div>
                <input className="form-control" type="text" name="name" defaultValue={item.name} ref={setRef} />
            </div>
            <div className="input-group">
                <div className="input-group-prepend">
                    <span className="input-group-text">expression:</span>
                </div>
                <input className="form-control" type="text" name="expression" defaultValue={item.expression} ref={setRef} />
            </div>
        </div>
    )
    const readDisplay = (item) => <span>{item.name}: {item.expression}</span>
    return <Group
        title="Rolls"
        editDisplay={display} readDisplay={readDisplay}
        {...props}
    />
}

function Resources(props) {
    const display = (item, setRef) => (
        <div className="w-100">
            <div className="input-group">
                <div className="input-group-prepend">
                    <span className="input-group-text">name:</span>
                </div>
                <input className="form-control" type="text" name="name" defaultValue={item.name} ref={setRef} />
            </div>
            <div className="input-group">
                <div className="input-group-prepend">
                    <span className="input-group-text">uses:</span>
                </div>
                <input className="form-control" type="number" name="current" defaultValue={item.current} ref={setRef} />
                <span className="input-group-text">/</span>
                <input className="form-control" type="number" name="max" defaultValue={item.max} ref={setRef} />
                <span className="input-group-text">per</span>
                <select className="form-control" name="recover" defaultValue={item.recover} ref={setRef}>
                    <option value="short">short rest</option>
                    <option value="long">long rest</option>
                    <option value="other">other</option>
                </select>
            </div>
        </div>
    )
    const readDisplay = (item) => <span>{item.name}: {item.current}/{item.max} per {item.recover} rest</span>
    return <Group
        title="Resources"
        editDisplay={display} readDisplay={readDisplay}
        {...props}
    />
}

function Spells(props) {
    const display = (item, setRef) => (
        <div className="w-100">
            <div className="input-group">
                <div className="input-group-prepend">
                    <span className="input-group-text">name:</span>
                </div>
                <input className="form-control" type="text" name="name" defaultValue={item.name} ref={setRef} />
                <div className="input-group-prepend">
                    <span className="input-group-text">level:</span>
                </div>
                <input className="form-control" type="number" name="level" defaultValue={item.level} ref={setRef} />
            </div>
            <textarea className="form-control" name="description" defaultValue={item.description || ''} ref={setRef} />
        </div>
    )
    const readDisplay = (item) => (
        <div className="w-100 form-group">
            <span>{item.name} | level: {item.level}</span>
            <textarea className="form-control" name="description" value={item.description} readOnly={true} />
        </div>
    )
    return <Group
        title="Spells"
        editDisplay={display} readDisplay={readDisplay}
        {...props}
    />
}

function Inventory(props) {
    const display = (item, setRef) => (
        <div className="w-100">
            <div className="input-group">
                <div className="input-group-prepend">
                    <span className="input-group-text">name:</span>
                </div>
                <input className="form-control" type="text" name="name" defaultValue={item.name} ref={setRef} />
                <div className="input-group-prepend">
                    <span className="input-group-text">quantity:</span>
                </div>
                <input className="form-control" type="number" name="number" defaultValue={item.number} ref={setRef} />
            </div>
            <textarea className="form-control" name="description" defaultValue={item.description || ''} ref={setRef} />
        </div>
    )
    const readDisplay = (item) => (
        <div className="w-100 form-group">
            <span>{item.name} | quantity: {item.number}</span>
            <textarea className="form-control" name="description" value={item.description} readOnly={true} />
        </div>
    )
    return <Group
        title="Inventory"
        editDisplay={display} readDisplay={readDisplay}
        {...props}
    />
}

class Character extends React.Component {
    constructor(props) {
        super(props)
        this.error = this.error.bind(this)
        this.state = {error: undefined, readOnly: undefined}
    }

    error(message) {
        this.setState({error: message})
    }

    componentDidMount() {
        this.request = $.ajax({
            url: '/rest/character',
            type: 'GET',
            dataType: 'json',
            data: {
                character: this.props.character_id,
            },
            error: () => this.error("Could not load character"),
            success: (data) => this.setState({readOnly: data.own}),
        })
    }

    componentDidCatch(error, info) {
        this.error("Unknown error")
    }

    render() {
        if (this.state.error === undefined && this.state.readOnly !== undefined) {
            const unclaim = (this.state.readOnly) ? "" : <div>
                <br />
                <a className="btn btn-danger" href={"/unclaim?character=" + this.props.character_id}>Unclaim character</a>
            </div>
            return (
                <div>
                    <Information character_id={this.props.character_id} onError={this.error} readOnly={this.state.readOnly} />
                    <Variables character_id={this.props.character_id} onError={this.error} readOnly={this.state.readOnly} />
                    <Rolls character_id={this.props.character_id} onError={this.error} readOnly={this.state.readOnly} />
                    <Resources character_id={this.props.character_id} onError={this.error} readOnly={this.state.readOnly} />
                    <Spells character_id={this.props.character_id} onError={this.error} readOnly={this.state.readOnly} />
                    <Inventory character_id={this.props.character_id} onError={this.error} readOnly={this.state.readOnly} />
                    {unclaim}
                </div>
            )
        }
        else if (this.state.error === undefined) {
            return (
                <Warning>Loading...</Warning>
            )
        }
        else {
            return (
                <Error>{this.state.error}</Error>
            )
        }
    }
}

const character = urlparams.get("character")
ReactDOM.render(
    <Character character_id={character} />,
    document.getElementById("root")
)
