import colors from 'colors'
import server from './server'

const port = Number(process.env.PORT )|| 4000
// HOST=127.0.0.1 cuando hay un Nginx delante (el puerto no queda expuesto a internet)
const host = process.env.HOST || '0.0.0.0'

server.listen(port, host, () => {
    console.log( colors.cyan.bold( `REST API en el puerto ${port}`))
})