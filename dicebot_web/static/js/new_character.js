class NewCharacter extends React.Component {
    render() {
        return (
            <form method="post">
                <input type="hidden" name="server" value={this.props.server_id} />
                <div className="form-group">
                    <label htmlFor="name">Name</label>
                    <input id="name" className="form-control" type="text" name="name" />
                </div>
                <Stats />
                <Proficiencies />
                <div className="form-group">
                    <button className="form-control" type="submit">Create</button>
                </div>
            </form>
        )
    }
}

class Stats extends React.Component {
    stats = {
        "Strength": "str-score",
        "Dexterity": "dex-score",
        "Constitution": "con-score",
        "Intelligence": "int-score",
        "Wisdom": "wis-score",
        "Charisma": "cha-score",
        "Proficiency Bonus": "prof",
    }

    render() {
        let list = Object.entries(this.stats).map((item) =>
            <Stat key={item[1]} name={item[0]} shortName={item[1]} />
        )
        return (
            <div className="form-group">
                <h2>Stats:</h2>
                <div className="row">{list}</div>
            </div>
        )
    }
}

class Stat extends React.Component {
    render() {
        let name = this.props.shortName
        return (
            <div className="col-xs-12 col-sm-6 col-md-4 col-lg-3">
                <label htmlFor={name}>{this.props.name}</label>
                <input id={name} className="form-control" type="number" name={name} value={0} />
            </div>
        )
    }
}

class Proficiencies extends React.Component {
    skills = [
        "Acrobatics",
        "Animal Handling",
        "Arcana",
        "Athletics",
        "Deception",
        "History",
        "Insight",
        "Intimidation",
        "Investigation",
        "Medicine",
        "Nature",
        "Perception",
        "Performance",
        "Persuasion",
        "Religion",
        "Sleight of Hand",
        "Stealth",
        "Survival",
    ]

    render() {
        let list = this.skills.map((item) =>
            <Skill key={item} name={item} />
        )
        return (
            <div className="form-group">
                <h2>Proficiencies:</h2>
                <ul className="list-group">{list}</ul>
            </div>
        )
    }
}

class Skill extends React.Component {
    constructor(props) {
        super(props)
        this.state = {checked: "0"}
    }

    render() {
        const name = this.props.name.toLowerCase().replace(' ', '-')
        let active = (item) => item == this.state.checked
        let list = ["0", "1/2", "1", "2"].map((item) =>
            <label key={item} className={"btn btn-secondary" + (active(item) ? " active" : "")}>
                <input className="sr-only" type="radio" name={name} value={item} defaultChecked={active(item)} />
                {item}
            </label>
        )
        return (
            <li className="list-group-item">
                <p>{this.props.name} proficiency</p>
                <div className="btn-group btn-group-sm">{list}</div>
            </li>
        )
    }
}

class Resources extends React.Component {
    constructor(props) {
        super(props)
        this.newItem = this.newItem.bind(this)
        this.remove = this.remove.bind(this)
        this.state = {resources: [{name: "hp", max: 0, rest: "long"}]}
    }
    
    newItem() {
        this.setState((prevState, props) => (
            {resources: prevState.resources.concat([{
                name: dialog(...),
                max: 0,
                rest: "other",
            }])}
        ))
    }
    
    remove() {
        ...
    }
    
    render() {
        let list = this.state.resources.map((item, index) =>
            <Resource key={index} name={item.name} max={item.max} rest={item.rest} remove={this.remove} />
        )
        return (
            <div className="form-group">
                <h2>Limited use resources:</h2>
                <ul className="list-group">
                    {list}
                    <li className="list-group-item"><a onClick={this.newItem}>+ Add</a></li>
                </ul>
            </div>
        )
    }
}

class Resource extends React.Component {
    render() {
        <li className="list-group-item">
            {this.props.name}
            <input type="hidden" name={this.props.name + "-name"} value={this.props.name} />
            Max:
            <input className="form-control" type="number" name={this.props.name + "-max"} value={this.props.max} />
            Rest type:
            <select name={this.props.name + "-rest"}>
                <option value="short" defaultChecked={this.props.rest == "short"}>Short</option>
                <option value="long" defaultChecked={this.props.rest == "long"}>Long</option>
                <option value="other" defaultChecked={this.props.rest == "other"}>Other</option>
            </select>
            <button onClick={this.props.remove}>Remove</button>
        </li>
    }
}

function Error(props) {
    return (
        <div>
            <p className="alert alert-danger">{props.message}</p>
        </div>
    )
}

let urlparams = new URLSearchParams(window.location.search)
ReactDOM.render(
    <NewCharacter server_id={urlparams.get("server")} />,
    document.getElementById("root")
)
