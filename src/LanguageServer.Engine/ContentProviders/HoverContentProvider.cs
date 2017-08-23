using Lsp.Models;
using System;
using System.IO;
using System.Text;
using System.Linq;

namespace DocFXAssistant.LanguageServer.ContentProviders
{
    using Documents;
    using Utilities;

    /// <summary>
    ///     Content for tooltips when hovering over text in a document.
    /// </summary>
    public class HoverContentProvider
    {
        /// <summary>
        ///     The document for which hover content is provided.
        /// </summary>
        readonly Document _document;

        /// <summary>
        ///     Create a new <see cref="HoverContentProvider"/>.
        /// </summary>
        /// <param name="document">
        ///     The document for which hover content is provided.
        /// </param>
        public HoverContentProvider(Document document)
        {
            if (document == null)
                throw new ArgumentNullException(nameof(document));
            
            _document = document;
        }

        // TODO: Implement hover content.
    }
}
