const int inputPin = A0;

void setup() {
  Serial.begin(115200);
}

void loop() {
  int value = analogRead(inputPin);

  Serial.println(value);

  delay(1);
}