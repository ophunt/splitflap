import { FLAPS } from "./consts";

export const sleep = async (timeout: number) => {
    await new Promise((resolve) => {
        setTimeout(resolve, timeout);
    })
}

const charToFlapIndex = (c: string): number | null => {
    const i = FLAPS.indexOf(c)
    if (i >= 0) {
        return i
    } else {
        return null
    }
}

export const stringToFlapIndexArray = (str: string): Array<number | null> => {
    return str.split('').map(charToFlapIndex)
}
