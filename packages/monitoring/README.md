# Salto - Monitoring

This project is a tool to monitor changes in a service

### Build instructions

```bash
yarn ; yarn build
```

### Configuration

```hcl
monitoring {
  triggers = [
    {
      name = "example"
      elementIdsRegex = [
      	".*hello.*"
      ]
    },
  ]
  notifications = [
  	{
  	  type = "email"
  	  title = "Salto | New Alert"
  	  from = "alerts@salto.io"
  	  to = [
  	  	"test@salto.io"
  	  ]
  	  triggers = [
  	  	"example"
  	  ]
  	}
  ]
  smtp = {
  	ssl = true
  	host = "smtp.gmail.com"
  	port = 465
  	username = "alerts@salto.io"
  	password = "supersecret"
  }
  slack {
    token = "xoxb-thisis-nota-validtoken"
  }
  telemetry {
    id = "clientuniqueid"
    url = "https://telemetry.salto.io"
    token = "supersecrettelemetrytoken"
    enabled = true
  }
}
```

### Run

```bash
./bin/salto_monitoring --workspace /path/to/workspace --env envName --config /path/to/config.nacl
```
