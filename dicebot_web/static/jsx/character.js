class Group extends React.Component {
    constructor(props) {
        super(props)
        this.error = this.error.bind(this)
        this.reload = this.reload.bind(this)
        this.collapse = this.collapse.bind(this)
        this.addItem = this.addItem.bind(this)
        this.updateItem = this.updateItem.bind(this)
        this.deleteItem = this.deleteItem.bind(this)
        this.state = {data: undefined, open: false}
    }

    error(message, jqXHR) {
        this.props.onError(message, jqXHR)
    }

    reload(e) {
        this.setState({data: undefined})
        this.componentDidMount()
    }

    collapse(e) {
        this.setState((prevState, props) => ({open: !prevState.open}))
    }

    componentDidMount() {
        const url = '/api/characters/' + this.props.character_id + '/' + this.props.url
        this.request = $.ajax({
            url: url,
            type: 'GET',
            dataType: 'json',
            error: (jqXHR) => this.error("Failed to load " + this.props.title.toLowerCase(), jqXHR),
            success: (data) => this.setState({data: data}),
        })
    }

    componentWillUnmount() {
        abortRequest(this.request)
        abortRequest(this.addRequest)
        abortRequest(this.updateRequest)
        abortRequest(this.deleteRequest)
    }

    addItem() {
        const name = prompt("Please enter the name of the new item:", "")
        if (!name) {return}
        const url = '/api/characters/' + this.props.character_id + '/' + this.props.url
        this.addRequest = $.ajax({
            url: url,
            type: 'POST',
            dataType: 'json',
            data: {
                name: name,
            },
            error: (jqXHR) => {
                if (jqXHR.status == 409) {
                    alert("There is already an item in " + this.props.title + " with the given name")
                }
                else {
                    this.error("Failed to add item", jqXHR)
                }
            },
            success: (newItem) => this.setState((prevState, props) => ({data: prevState.data.concat([newItem])})),
        })
    }

    updateItem(item, ...updated) {
        const url = '/api/characters/' + this.props.character_id + '/' + this.props.url + '/' + item.id
        const data = {}
        updated.map(key => data[key] = item[key])
        this.updateRequest = $.ajax({
            url: url,
            type: 'PATCH',
            dataType: 'json',
            data: data,
            error: (jqXHR) => {
                if (jqXHR.status == 400) {
                    alert("Cannot update item \"" + data.name + "\" in " + this.props.title + " with the given values")
                }
                else if (jqXHR.status == 404) {
                    this.setState((prevState, props) => ({data: prevState.data.filter((i) => i.id != item.id)}))
                }
                else if (jqXHR.status == 409) {
                    alert("There is already an item in " + this.props.title + " with the given name")
                }
                else {
                    this.error("Failed to update item", jqXHR)
                }
            },
            success: (newItem) => this.setState((prevState, props) => ({data: prevState.data.map((item) => (item.id == newItem.id) ? newItem : item)})),
        })
    }

    deleteItem(id) {
        const url = '/api/characters/' + this.props.character_id + '/' + this.props.url + '/' + id
        this.deleteRequest = $.ajax({
            url: url,
            type: 'DELETE',
            dataType: 'json',
            error: (jqXHR) => this.error("Failed to remove item", jqXHR),
            success: () => this.setState((prevState, props) => ({data: prevState.data.filter((item) => item.id != id)})),
        })
    }

    render() {
        let body
        if (this.state.data !== undefined) {
            const list = this.state.data.map((item) => (
                <GroupItem key={item.id} updateItem={this.updateItem} deleteItem={this.deleteItem} editDisplay={this.props.editDisplay} readDisplay={this.props.readDisplay} readOnly={this.props.readOnly} item={item} />
            ))
            const addItem = (this.props.readOnly) ? null : <li className="list-group-item"><button className="btn btn-secondary w-100" onClick={this.addItem}>+ New</button></li>
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
                <div className="d-flex justify-content-between align-items-center">
                    <button className="btn btn-outline-secondary" onClick={this.collapse}>{(this.state.open) ? '-' : '+'}</button>
                    <h2 className="d-inline-block m-2">{this.props.title}</h2>
                    <button className="btn btn-outline-info" onClick={this.reload}>Reload</button>
                </div>
                <div className={"spoiler " + ((this.state.open) ? "open" : "closed")}>{body}</div>
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

    cancel(e) {
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
            const edit = (this.props.readOnly) ? null : <button className="btn btn-info badge badge-info badge-pill m-1" onClick={this.editItem}>edit</button>
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
            <span className="font-weight-bold">{item.name}</span>
            <Markdown content={item.description} />
        </div>
    )
    return <Group title="Information" url="information" editDisplay={display} readDisplay={readDisplay} {...props} />
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
    const readDisplay = (item) => (
        <span>
            <span className="font-weight-bold">{item.name}: </span>
            {item.value}
        </span>
    )
    return <Group title="Variables" url="variables" editDisplay={display} readDisplay={readDisplay} {...props} />
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
    const readDisplay = (item) => (
        <span>
            <span className="font-weight-bold">{item.name}: </span>
            {item.expression}
        </span>
    )
    return <Group title="Rolls" url="rolls" editDisplay={display} readDisplay={readDisplay} {...props} />
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
    const readDisplay = (item) => (
        <span>
            <span className="font-weight-bold">{item.name}: </span>
            {item.current}/{item.max} per {item.recover} rest
        </span>
    )
    return <Group title="Resources" url="resources" editDisplay={display} readDisplay={readDisplay} {...props} />
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
            <span className="font-weight-bold">{item.name}</span>
            <span> | level: {item.level}</span>
            <Markdown content={item.description} />
        </div>
    )
    return <Group title="Spells" url="spells" editDisplay={display} readDisplay={readDisplay} {...props} />
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
            <span className="font-weight-bold">{item.name}</span>
            <span> | quantity: {item.number}</span>
            <Markdown content={item.description} />
        </div>
    )
    return <Group title="Inventory" url="inventory" editDisplay={display} readDisplay={readDisplay} {...props} />
}

class Name extends React.Component {
    constructor(props) {
        super(props)
        this.error = this.error.bind(this)
        this.editItem = this.editItem.bind(this)
        this.cancel = this.cancel.bind(this)
        this.updateItem = this.updateItem.bind(this)
        this.state = {edit: false}
    }

    error(message, jqXHR) {
        this.props.onError(message, jqXHR)
    }

    editItem(e) {
        this.setState({edit: true})
    }

    cancel(e) {
        this.setState({edit: false})
        this.nameRef = undefined
    }

    updateItem(e) {
        const url = '/api/characters/' + this.props.character.id
        const name = this.nameRef.value
        this.updateRequest = $.ajax({
            url: url,
            type: 'PATCH',
            dataType: 'json',
            data: {name: name},
            error: (jqXHR) => {
                if (jqXHR.status == 409) {
                    alert("There is already a character named " + name + " on this server")
                }
                else {
                    this.error("Failed to update name", jqXHR)
                }
            },
            success: this.props.onUpdate,
        })
        this.cancel()
    }

    componentWillUnmount() {
        abortRequest(this.request)
    }

    render() {
        if (this.state.edit) {
            return (
                <div className="form-group d-flex justify-content-between align-items-center">
                    <input className="form-control" type="text" name="name" defaultValue={this.props.character.name} ref={(t) => this.nameRef = t} />
                    <div className="d-flex flex-column">
                        <button className="btn btn-success badge badge-success badge-pill m-1" onClick={this.updateItem}>save</button>
                        <button className="btn btn-warning badge badge-warning badge-pill m-1" onClick={this.cancel}>cancel</button>
                    </div>
                </div>
            )
        }
        else {
            const edit = (this.props.readOnly) ? null : <button className="btn btn-info badge badge-info badge-pill m-1" onClick={this.editItem}>edit</button>
            return (
                <div className="mb-3 border-bottom d-flex justify-content-between align-items-center">
                    <h1 className="d-inline-block">{this.props.character.name}</h1>
                    {edit}
                </div>
            )
        }
    }
}

class Character extends React.Component {
    constructor(props) {
        super(props)
        this.error = this.error.bind(this)
        this.updateCharacter = this.updateCharacter.bind(this)
        this.state = {}
    }

    error(message, jqXHR) {
        this.props.onError(message, jqXHR)
    }

    componentDidMount() {
        this.request = $.ajax({
            url: '/api/characters/' + this.props.character_id,
            type: 'GET',
            dataType: 'json',
            error: (jqXHR) => this.error("Failed to load character", jqXHR),
            success: (data) => this.setState({character: data}, loadMore),
        })
        const loadMore = () => {
            document.title = this.state.character.name
            this.serverRequest = $.ajax({
                url: '/api/server/' + this.state.character.server,
                type: 'GET',
                dataType: 'json',
                error: (jqXHR) => this.error("Failed to load server", jqXHR),
                success: (data) => this.setState({server: data}),
            })
            if (this.state.character.user !== null) {
                this.userRequest = $.ajax({
                    url: '/api/user/' + this.state.character.user,
                    type: 'GET',
                    dataType: 'json',
                    data: {server: this.state.character.server},
                    error: (jqXHR) => this.error("Failed to load user", jqXHR),
                    success: (data) => this.setState({user: data}),
                })
            }
        }
    }

    componentWillUnmount() {
        abortRequest(this.request)
        abortRequest(this.userRequest)
        abortRequest(this.serverRequest)
    }

    updateCharacter(data) {
        this.setState({character: data}, () => document.title = this.state.character.name)
    }

    render() {
        let body
        if (this.state.character !== undefined) {
            const readOnly = !this.state.character.own

            let user
            if (this.state.character.user === null) {
            }
            else if (this.state.user === undefined) {
                user = <Warning>Loading user...</Warning>
            }
            else {
                user = <User user={this.state.user} href={(readOnly) ? undefined : "/"} />
            }

            const server = (this.state.server === undefined) ? <Warning>Loading server...</Warning> : <Server server={this.state.server} href={"/character-list?server=" + this.state.server.id} />

            let unclaim
            if (!readOnly) {
                unclaim = (
                    <p><LoadingButton
                        className="btn btn-danger"
                        url={'/api/characters/' + this.props.character_id}
                        method="PATCH"
                        data={{user: 'null'}}
                        callback={(data) => window.location = '/character-select?server=' + data.server}
                        onError={this.error}>
                        Unclaim character
                    </LoadingButton></p>
                )
            }

            body = (
                <div>
                    <Name character={this.state.character} onUpdate={this.updateCharacter} onError={this.error} readOnly={readOnly} />
                    {server}
                    {user}
                    {unclaim}
                    <ErrorHandler><Information character_id={this.state.character.id} readOnly={readOnly} /></ErrorHandler>
                    <ErrorHandler><Spells character_id={this.state.character.id} readOnly={readOnly} /></ErrorHandler>
                    <ErrorHandler><Variables character_id={this.state.character.id} readOnly={readOnly} /></ErrorHandler>
                    <ErrorHandler><Rolls character_id={this.state.character.id} readOnly={readOnly} /></ErrorHandler>
                    <ErrorHandler><Resources character_id={this.state.character.id} readOnly={readOnly} /></ErrorHandler>
                    <ErrorHandler><Inventory character_id={this.state.character.id} readOnly={readOnly} /></ErrorHandler>
                </div>
            )
        }
        else {
            body = <Warning>Loading...</Warning>
        }
        return <Container>{body}</Container>
    }
}

const character = urlparams.get("character")
if (character !== null) {
    ReactDOM.render(
        <ErrorHandler><Character character_id={character} /></ErrorHandler>,
        document.getElementById("root")
    )
}
else {
    ReactDOM.render(
        <Container><Error>Bad request, no character specified</Error></Container>,
        document.getElementById("root")
    )
}
