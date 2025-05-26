import SerialPort = require('serialport')

import readline from 'readline'

import { SplitflapNode } from 'splitflapjs-node'
import { PB } from 'splitflapjs-proto'
import { applySetFlaps } from 'splitflapjs-core/dist/util'
import { getWeather } from './weather'

import { FLAPS, DEGREE_CHAR, SCALES } from './consts'

// Edit this to restrict to a single device based on serial number, e.g. add something like '02280A9E' to this array.
// If this is left blank, a serial device matching the vendor/product codes from SplitflapNode.USB_DEVICE_FILTERS
// will be selected.
const USB_SERIAL_NUMBERS: Array<string> = []

const main = async (): Promise<void> => {
    const ports = await SerialPort.list()

    const matchingPorts = ports.filter((portInfo) => {
        return USB_SERIAL_NUMBERS.length > 0
            ? portInfo.serialNumber !== undefined && USB_SERIAL_NUMBERS.includes(portInfo.serialNumber)
            : SplitflapNode.USB_DEVICE_FILTERS.some(
                (f) =>
                    f.usbVendorId.toString(16).toLowerCase() === portInfo.vendorId?.toLowerCase() &&
                    f.usbProductId.toString(16).toLowerCase() === portInfo.productId?.toLowerCase(),
            )
    })

    if (matchingPorts.length < 1) {
        console.error(`No splitflap usb serial port found! ${JSON.stringify(ports, undefined, 4)}`)
        return
    } else if (matchingPorts.length > 1) {
        console.error(
            `Multiple possible splitflap usb serial ports found: ${JSON.stringify(matchingPorts, undefined, 4)}`,
        )
        // TODO: offer option to select one via input rather than failing hard
        return
    }

    const portInfo = matchingPorts[0]
    let splitflapConfig = PB.SplitflapConfig.create()
    let onSplitflapStateReceived: () => void
    const splitflapStateReceived = new Promise((resolve) => onSplitflapStateReceived = () => resolve(null));
    const splitflap = new SplitflapNode(
        portInfo.path,
        (message: PB.FromSplitflap) => {
            if (message.payload === 'log' && message.log) {
                console.log(message.log.msg)
            } else if (
                message.payload === 'splitflapState' &&
                message.splitflapState &&
                message.splitflapState.modules
            ) {
                console.log(
                    `State:\n${message.splitflapState.modules.map((mod) => {
                        return mod.flapIndex
                    })}`,
                )
                if (splitflapConfig.modules.length === 0) {
                    // First time we get a state report, initialize our config with the appropriate number of modules
                    for (let i = 0; i < message.splitflapState.modules.length; i++) {
                        splitflapConfig.modules.push(PB.SplitflapConfig.ModuleConfig.create({
                            targetFlapIndex: 0
                        }))
                    }
                    onSplitflapStateReceived()
                } else {
                    if (splitflapConfig.modules.length !== message.splitflapState.modules.length) {
                        console.warn('Number of modules in state is different than number of modules in config', {
                            nModulesState: message.splitflapState.modules.length,
                            nModulesConfig: splitflapConfig.modules.length,
                        })
                    }
                }
            } else if (message.payload === 'supervisorState' && message.supervisorState) {
                console.log(
                    `Supervisor state:\n${JSON.stringify(
                        PB.SupervisorState.toObject(message.supervisorState as PB.SupervisorState, { defaults: true }),
                        undefined,
                        4,
                    )}`,
                )
            }
        },
    )

    // const rl = readline.createInterface({
    //     input: process.stdin,
    //     output: process.stdout,
    // })
    // const reset = await new Promise<string>((resolve) => {
    //     rl.question('Reset? y/n', resolve)
    // })
    await new Promise((resolve) => {
        setTimeout(resolve, 3000);
    })
    const reset = 'y';
    if (reset === 'y') {
        await splitflap.hardReset()
    }

    // TODO: make this wait for idle instead of just any state
    // console.log('Waiting to hear from Splitflap...')
    // await splitflapStateReceived
    // console.log('State received, starting animation')

    // type anim = [number, string]
    // const animation: anim[] = [
    //     [6000, 'hello'],
    //     [15000, 'world'],
    // ]
    // let cur = 0

    let scale = SCALES.FAHRENHEIT;
    const runAnimation = async () => {
        // Get weather
        const weatherData = await getWeather(scale);
        const temp = weatherData.current.temperature2m.toFixed(0);
        const weather = `${temp}${DEGREE_CHAR}${scale}`
        // TODO: Set delay based on something
        const delay = 15000

        // Send message to flaps
        console.log(`Sending message "${weather}" to flaps`)
        splitflapConfig = applySetFlaps(splitflapConfig, stringToFlapIndexArray(weather))
        splitflap.sendConfig(splitflapConfig)

        // Wait to re-fetch, with opposite scale
        setTimeout(runAnimation, delay)
        scale = scale === SCALES.CELCIUS ? SCALES.FAHRENHEIT : SCALES.CELCIUS;
    }

    runAnimation()
}

const charToFlapIndex = (c: string): number | null => {
    const i = FLAPS.indexOf(c)
    if (i >= 0) {
        return i
    } else {
        return null
    }
}

const stringToFlapIndexArray = (str: string): Array<number | null> => {
    return str.split('').map(charToFlapIndex)
}

main()
