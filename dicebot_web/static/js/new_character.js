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
