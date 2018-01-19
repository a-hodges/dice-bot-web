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
    const size = (props.iconSize) ? props.iconSize : 32
    const avatar = (props.user.avatar)
        ? 'https://cdn.discordapp.com/avatars/' + props.user.id + '/' + props.user.avatar + '.png?size=' + size
        : 'https://cdn.discordapp.com/embed/avatars/0.png?size=' + size
    const name = (props.user.nick) ? props.user.nick + ' (' + props.user.username + ')' : props.user.username
    let body = (
        <span>
            {(props.hidePrefix) ? null : "User: "}<img className="img-thumbnail" src={avatar} alt={props.user.username + " icon"} /> {name}
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
    const size = (props.iconSize) ? props.iconSize : 32
    const icon = (props.server.icon)
        ? 'https://cdn.discordapp.com/icons/' + props.server.id + '/' + props.server.icon + '.png?size=' + size
        : 'https://cdn.discordapp.com/embed/avatars/0.png?size=' + size
    let body = (
        <span>
            {(props.hidePrefix) ? null : "Server: "}<img className="img-thumbnail" src={icon} alt={props.server.name + " icon"} /> {props.server.name}
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
