export type Province = {
  id: number;
  name: string;
};

export type City = {
  id: number;
  name: string;
  zipCode: string;
};

export type GeocodeResult = {
  latitude: number;
  longitude: number;
};
