function lines(str) {
    if (str) {
        return str.split("\n").map((item, i) => <span key={i}><br /> {item}</span>)
    }
    else {
        return ""
    }
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

const urlparams = new URLSearchParams(window.location.search)
