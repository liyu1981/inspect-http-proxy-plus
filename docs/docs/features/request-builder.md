# HTTP Request Builder

Need to replay a request with a slight modification? The Request Builder has you covered.

## Composing Requests
You can manually build requests from scratch:
- Choose any HTTP Method (`GET`, `POST`, `PUT`, `DELETE`, etc.).
- Add custom Headers.
- Define the Request Body.

## Replaying from History
Any captured request can be sent to the Builder with a single click. This populates the form with the original data, allowing you to tweak values before re-sending.

![Request Builder Form](/img/request_builder_form.png)

## Multipart/Form-Data
The builder supports complex form submissions, including file uploads and multiple text fields.

## CURL Export
Every request in `ihpp` can be exported as a standard `curl` command, making it easy to share or run in your terminal.

![CURL Export](/img/export_button_and_curl_snippet.gif)
