from rest_framework.negotiation import DefaultContentNegotiation


class FormatIsFileType(DefaultContentNegotiation):
    # drf would read ?format= as a renderer name; on file downloads it picks the file type instead
    def select_renderer(self, request, renderers, format_suffix=None):
        return renderers[0], renderers[0].media_type
