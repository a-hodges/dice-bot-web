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

function User(props) {
    const avatar = (props.user.avatar)
        ? 'https://cdn.discordapp.com/avatars/' + props.user.id + '/' + props.user.avatar + '.png?size=32'
        : 'https://cdn.discordapp.com/embed/avatars/0.png?size=32'
    const name = (props.user.nick) ? props.user.nick + ' (' + props.user.username + ')' : props.user.username
    let body = (
        <span>
            User: <img className="icon" src={avatar} alt={props.user.username + " icon"} /> {name}
        </span>
    )
    if (props.link) {
        body = <a href="/">{body}</a>
    }
    if (!props.inline) {
        body = <p>{body}</p>
    }
    return body
}

function Server(props) {
    const icon = (props.server.icon)
        ? 'https://cdn.discordapp.com/icons/' + props.server.id + '/' + props.server.icon + '.png?size=32'
        : 'https://cdn.discordapp.com/embed/avatars/0.png?size=32'
    let body = (
        <span>
            Server: <img className="icon" src={icon} alt={props.server.name + "icon"} /> {props.server.name}
        </span>
    )
    if (props.link) {
        body = <a href={"/list_characters?server=" + props.server.id}>{body}</a>
    }
    if (!props.inline) {
        body = <p>{body}</p>
    }
    return body
}

const urlparams = new URLSearchParams(window.location.search)
