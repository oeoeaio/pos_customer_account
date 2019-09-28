from odoo import models, fields, api
import csv
import base64
import io
from odoo.exceptions import UserError, ValidationError

import logging

_logger = logging.getLogger(__name__)

class BulkImport(models.TransientModel):
    _name = 'pos.customer.account.bulk_import'

    data = fields.Binary(string="Upload File")
    file_name = fields.Char(string="File Name")

    def memoize(f):
        memo = {}
        def helper(x):
            if x not in memo:
                memo[x] = f(x)
            return memo[x]
        return helper

    @api.multi
    def action_import(self):
        readCSV = csv.DictReader(self._data_file(), delimiter=',')
        for row in readCSV:
            self._apply(row)
        return {}

    def _data_file(self):
        decoded_data = base64.b64decode(self.data)
        data_str = decoded_data.decode('utf-8')
        return io.StringIO(data_str)

    @memoize
    def _counterpart_account_id(self):
        return self.env.ref('l10n_au.1_au_11200').id

    @memoize
    def _account_id(self):
        return self.env.ref('pos_customer_account.customer_account_account').id

    @memoize
    def _journal_id(self):
        return self.env.ref('pos_customer_account.pos_customer_account_journal').id

    @api.multi
    def _apply(self, row):
        _logger.info(row)
        partner = self.env['ir.model.data'].get_object('', row['customer'])
        _logger.info(partner.name)
        amount = float(row['amount'])

        move = self._create_account_move(row['date'], row['reference'])
        lines = [(0,0,{
            'name': row['description'],
            'move_id': move.id,
            'account_id': self._account_id(),
            'partner_id': partner.id,
            'credit': amount,
            'debit': 0.0,
        }),(0,0,{
            'name': row['description'],
            'move_id': move.id,
            'account_id': self._counterpart_account_id(),
            'partner_id': partner.id,
            'credit': 0.0,
            'debit': amount,
        })]
        _logger.info(str(lines))
        move.sudo().write({'line_ids': lines})
        move.sudo().post()
        return {}

    def _create_account_move(self, date, ref):
        return self.env['account.move'].sudo().create({'ref': ref, 'journal_id': self._journal_id(), 'date': date})
