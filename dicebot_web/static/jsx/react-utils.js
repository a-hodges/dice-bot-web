function abortRequest(request) {
    if (request !== undefined) {
        request.abort()
    }
}

function Container(props) {
    const className = (props.className) ? "container " + props.className : "container"
    return <div {...props} className={className}>{props.children}</div>
}

function Error(props) {
    return <p className="alert alert-danger">{props.children}</p>
}

function Warning(props) {
    return <p className="alert alert-warning">{props.children}</p>
}

function Paragraphs(props) {
    if (!props.children) {
        return null
    }
    else {
        let className = 'paragraphs border rounded p-3'
        className = (props.className) ? props.className + ' ' + className : className
        return (
            <div {...props} className={className}>
                {props.children}
            </div>
        )
    }
}

let remarkableOptions = {linkify: true}
let remarkableSubset = {
    core: ['block', 'inline', 'linkify'],
    block: ['fences', 'paragraph'],
    inline: ['backticks', 'del', 'emphasis', 'escape', 'text']
}

function discordRemarkable() {
    const md = new Remarkable('default', remarkableOptions)
    Object.entries(remarkableSubset).forEach((item) => md[item[0]].ruler.enable(item[1], true))
    return md
}

function Markdown(props) {
    if (!props.content) {
        return null
    }
    else {
        const md = discordRemarkable()
        let className = 'paragraphs border rounded p-3'
        className = (props.className) ? props.className + ' ' + className : className
        return (
            <div {...props} className={className} content={undefined} dangerouslySetInnerHTML={{__html: md.render(props.content).trim()}} />
        )
    }
}

function User(props) {
    const size = props.iconSize || 32
    const avatar = (props.user.avatar)
        ? 'https://cdn.discordapp.com/avatars/' + props.user.id + '/' + props.user.avatar + '.png?size=' + size
        : 'https://cdn.discordapp.com/embed/avatars/' + props.user.discriminator % 5 + '.png?size=' + size
    const name = (props.user.nick) ? props.user.nick + ' (' + props.user.username + ')' : props.user.username
    let body = (
        <span>
            {(props.hidePrefix) ? null : "User: "}<img className={"img-thumbnail icon-" + size} src={avatar} alt={props.user.username + " icon"} /> {name}
        </span>
    )
    if (props.href) {
        body = <a href={props.href}>{body}</a>
    }
    if (!props.inline) {
        body = <p>{body}</p>
    }
    return body
}

function Server(props) {
    const size = props.iconSize || 32
    const icon = (props.server.icon)
        ? 'https://cdn.discordapp.com/icons/' + props.server.id + '/' + props.server.icon + '.png?size=' + size
        : 'https://cdn.discordapp.com/embed/avatars/0.png?size=' + size
    let body = (
        <span>
            {(props.hidePrefix) ? null : "Server: "}<img className={"img-thumbnail icon-" + size} src={icon} alt={props.server.name + " icon"} /> {props.server.name}
        </span>
    )
    if (props.href) {
        body = <a href={props.href}>{body}</a>
    }
    if (!props.inline) {
        body = <p>{body}</p>
    }
    return body
}

class LoadingButton extends React.Component {
    constructor(props) {
        super(props)
        this.error = this.error.bind(this)
        this.onClick = this.onClick.bind(this)
        this.state = {loading: false}
    }

    error(message, jqXHR) {
        this.setState({loading: false})
        this.props.onError(message, jqXHR)
    }

    onClick(e) {
        const callback = (data) => {
            this.setState({loading: false})
            this.props.callback(data)
        }
        this.setState({loading: true})
        console.log(this.props.data)
        this.request = $.ajax({
            url: this.props.url,
            type: this.props.method,
            dataType: 'json',
            data: this.props.data,
            error: (jqXHR) => this.error("Failed request", jqXHR),
            success: this.props.callback,
        })
    }

    componentWillUnmount() {
        if (this.request !== undefined) {
            this.request.abort()
        }
    }

    render() {
        if (!this.state.loading) {
            return <button {...this.props} callback="" onClick={this.onClick}>{this.props.children}</button>
        }
        else {
            return <button {...this.props} callback=""><span className="loading-animation" dot="&bull;">&bull;</span></button>
        }
    }
}

class ErrorHandler extends React.Component {
    constructor(props) {
        super(props)
        this.error = this.error.bind(this)
        this.state = {error: []}
    }

    error(message, jqXHR) {
        if (jqXHR !== undefined) {
            const status = jqXHR.status
            if (status == 400) {
                message += " Bad request"
            }
            else if (status == 401) {
                message += " You must be logged in to access this resource"
            }
            else if (status == 403) {
                message += " You do not have access to edit this character"
            }
            else if (status == 404) {
                message += " Could not be found"
            }
            else if (status == 409) {
                message += " Conflicted with another value"
            }
            else if (status == 500) {
                message += " Server error"
            }
        }
        this.setState((prevState, props) => ({error: [message].concat(prevState.error)}))
    }

    componentDidCatch(error, info) {
        this.error("Unknown error")
    }

    render() {
        if (this.state.error.length === 0) {
            return React.Children.map(this.props.children, (item) => React.cloneElement(item, {onError: this.error}))
        }
        else {
            return <Container>{this.state.error.map((item) => <Error key={item}>{item}</Error>)}</Container>
        }
    }
}

const urlparams = new URLSearchParams(window.location.search)
