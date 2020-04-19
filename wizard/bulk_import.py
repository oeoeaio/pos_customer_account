import csv, base64, io, re
from odoo import models, fields, api
from odoo.exceptions import ValidationError

import logging

_logger = logging.getLogger(__name__)

class BulkImport(models.TransientModel):
    _name = 'pos.customer.account.bulk_import'
    _EXPECTED_FIELDS = ['date', 'customer_id', 'label', 'reference', 'credit']

    data = fields.Binary(string="Upload File")
    file_name = fields.Char(string="File Name")

    def memoize(f):
        memo = {}
        def helper(x):
            if x not in memo:
                memo[x] = f(x)
            return memo[x]
        return helper

    def action_import(self):
        readCSV = csv.DictReader(self._data_file(), delimiter=',')
        self._validate_headers(readCSV.fieldnames)
        for row in readCSV:
            transaction = self._parse(row)
            self._check_for_existing_move(transaction)
            self._apply(transaction)
        return {}

    def _parse(self, row):
        return {
          'date': self._get_date(row['date']),
          'partner_id': self._get_partner_id(row['customer_id']),
          'label': self._get_label(row['label']),
          'reference': self._get_reference(row['reference']),
          'credit': self._get_credit(row['credit'])
        }

    def _data_file(self):
        decoded_data = base64.b64decode(self.data)
        data_str = decoded_data.decode('utf-8')
        return io.StringIO(data_str)

    def _validate_headers(self, fieldnames):
      if fieldnames != self._EXPECTED_FIELDS:
          expected_fields = ', '.join(self._EXPECTED_FIELDS)
          raise ValidationError("Unexpected field names found. Expected: %s." %(expected_fields))

    def _get_date(self, raw_date):
        match = re.search('^\d{4}-\d{1,2}-\d{1,2}$', raw_date)
        if match is None:
            raise ValidationError("Invalid date found (%s). Date must be formatted as YYYY-MM-DD." %(raw_date))
        return raw_date

    def _get_partner_id(self, external_id):
        try:
            partner = self.env['ir.model.data'].get_object('', external_id)
            return partner.id
        except ValueError:
            raise ValidationError("Could not find customer: %s." %(external_id))

    def _get_label(self, raw_label):
        if raw_label == '':
            raise ValidationError('Invalid empty label found. Label must be filled.')
        return raw_label

    def _get_reference(self, raw_reference):
        if raw_reference == '':
            raise ValidationError('Invalid empty reference found. Reference must be filled.')
        return raw_reference

    def _get_credit(self, raw_credit):
        try:
            credit = float(raw_credit)
            if credit <= 0:
                raise ValidationError("Invalid credit amount found (%s). Credit must be a positive number." %(raw_credit))
            return credit
        except ValueError:
            raise ValidationError("Invalid credit amount found (%s). Credit must be a positive number." %(raw_credit))

    @memoize
    def _counterpart_account_id(self):
        return self.env.ref('l10n_au.1_au_11200').id

    @memoize
    def _account_id(self):
        return self.env.ref('pos_customer_account.customer_account_account').id

    @memoize
    def _journal_id(self):
        return self.env.ref('pos_customer_account.pos_customer_account_journal').id

    def _check_for_existing_move(self, transaction):
        result = self.env['ir.model.data'].search_count([('name', '=', transaction['label'])])
        if result:
            raise ValidationError('Transaction %s already exists.' %(transaction['label']))

    def _apply(self, transaction):
        move = self._create_account_move(transaction['date'], transaction['reference'])
        self.env['ir.model.data'].create({'name': transaction['label'], 'model': 'account.move', 'res_id': move.id})

        lines = [(0,0,{
            'name': transaction['label'],
            'move_id': move.id,
            'account_id': self._account_id(),
            'partner_id': transaction['partner_id'],
            'credit': transaction['credit'],
            'debit': 0.0,
        }),(0,0,{
            'name': transaction['label'],
            'move_id': move.id,
            'account_id': self._counterpart_account_id(),
            'partner_id': transaction['partner_id'],
            'credit': 0.0,
            'debit': transaction['credit'],
        })]
        _logger.info(str(lines))
        move.sudo().write({'line_ids': lines})
        move.sudo().post()
        return {}

    def _create_account_move(self, date, ref):
        return self.env['account.move'].sudo().create({'ref': ref, 'journal_id': self._journal_id(), 'date': date})
