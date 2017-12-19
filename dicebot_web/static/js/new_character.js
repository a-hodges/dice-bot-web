class NewCharacter extends React.Component {
    render() {
        return (
            <form method="post">
                <input type="hidden" name="server" value={this.props.server_id} />
                <div className="form-group">
                    <label htmlFor="name">Name</label>
                    <input id="name" className="form-control" type="text" name="name" />
                </div>
                <div className="form-group">
                    <label htmlFor="hp">Name</label>
                    <input id="hp" className="form-control" type="number" name="hp" value={0} />
                </div>
                <Stats />
                <div className="form-group">
                    <button className="form-control" type="submit">Create</button>
                </div>
            </form>
        )
    }
}

class Stats extends React.Component {
    stats = {
        "Strength Modifier": "str",
        "Dexterity Modifier": "dex",
        "Constitution Modifier": "con",
        "Intelligence Modifier": "int",
        "Wisdom Modifier": "wis",
        "Charisma Modifier": "cha",
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
