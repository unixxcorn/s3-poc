import AWS from 'aws-sdk'
import express, { NextFunction, Response, Request } from 'express'
import config from './config.json'
import mime from 'mime'

async function main() {
    const app = express()
    const host = config.host
    const port = config.port

    AWS.config.credentials = new AWS.SharedIniFileCredentials({ profile: config.aws_profile })
    AWS.config.update({ region: config.aws_region })
    const s3 = new AWS.S3()

    app.get('/bucket/list', async (req, res, next) => {
        try {
            s3.listBuckets((err, list) => {
                if (err) next(err)
                res.json(list)
            })
        } catch (error) {
            next(error)
        }
    })

    app.get('/bucket/:bucket/list', async (req, res, next) => {
        try {
            s3.listObjectsV2(
                {
                    Bucket: req.params.bucket,
                },
                (err, list) => {
                    if (err) next(err)
                    res.json(list)
                },
            )
        } catch (error) {
            next(error)
        }
    })

    app.get('/obj/:bucket/:key', async (req, res, next) => {
        try {
            const params = {
                Bucket: req.params.bucket,
                Key: req.params.key,
            }
            s3.headObject(params, function (err, data) {
                if (err) {
                    // an error occurred
                    console.error(err)
                    return next()
                }
                const stream = s3.getObject(params).createReadStream()

                // forward errors
                stream.on('error', function error(err) {
                    //continue to the next middlewares
                    return next()
                })

                //Add the content type to the response (it's not propagated from the S3 SDK)
                res.set('Content-Type', mime.lookup(req.params.key))
                if (data.ContentLength) res.set('Content-Length', data.ContentLength.toString())
                if (data.LastModified) res.set('Last-Modified', data.LastModified.toString())
                res.set('ETag', data.ETag)

                stream.on('end', () => {
                    console.log('Served by Amazon S3: ' + req.params.key)
                    res.end()
                })
                //Pipe the s3 object to the response
                stream.pipe(res)
            })
        } catch (error) {
            next(error)
        }
    })

    app.use((err: any, req: Request, res: Response, next: NextFunction) => {
        res.status(err.status || 500)
        console.log(new Date().toString(), req.method, req.path, err)
        res.json(err)
    })

    app.listen(port, host, () => console.log(`Starting server at http://${host}:${port}`))
}

main()
