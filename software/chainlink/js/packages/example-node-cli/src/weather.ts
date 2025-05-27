import { fetchWeatherApi } from 'openmeteo';
import { SCALES, DEFAULT_LOCATION } from './consts';

let location = DEFAULT_LOCATION;

export const getWeather = async (scale: SCALES) => {
    const params = {
        ...{ location },
        "current": "temperature_2m",
        ...(scale === SCALES.FAHRENHEIT ? { "temperature_unit": "fahrenheit" } : {})
    }
    const url = "https://api.open-meteo.com/v1/forecast";
    const responses = await fetchWeatherApi(url, params);

    // Process first location. Add a for-loop for multiple locations or weather models
    const response = responses[0];

    // Attributes for timezone and location
    const utcOffsetSeconds = response.utcOffsetSeconds();
    const timezone = response.timezone();
    const timezoneAbbreviation = response.timezoneAbbreviation();
    const latitude = response.latitude();
    const longitude = response.longitude();

    const current = response.current()!;

    // Note: The order of weather variables in the URL query and the indices below need to match!
    const weatherData = {
        current: {
            time: new Date((Number(current.time()) + utcOffsetSeconds) * 1000),
            temperature2m: current.variables(0)!.value(),
        },
    };

    return weatherData;
}

export const setLocation = (locationQuery: string): void => {
    location = DEFAULT_LOCATION;
    // TODO: Get location via geocoding API
}
