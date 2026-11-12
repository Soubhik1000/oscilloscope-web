const int inputPin = A0;

bool streaming = false;

unsigned long lastSample = 0;

void setup() {
  Serial.begin(115200);
}

void loop() {

  // Receive commands from website
  while (Serial.available() > 0) {
    char command = Serial.read();

    if (command == '1') {
      streaming = true;
    }
    else if (command == '0') {
      streaming = false;
    }
  }

  // Send samples only when requested
  if (streaming) {
    // int value = analogRead(inputPin);
    // Serial.println(value);

    if (micros() - lastSample >= 2000) {

            lastSample = micros();

            int value = analogRead(inputPin);

            Serial.println(value);
    }
  }
}
