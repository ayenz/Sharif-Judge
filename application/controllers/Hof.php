<?php
/**
 * SharIF Judge online judge
 * @file Hof.php
 * @author Stillmen Vallian <stillmen.v@gmail.com>
 */
defined('BASEPATH') OR exit('No direct script access allowed');

class Hof extends CI_Controller
{


	public function __construct()
	{
		parent::__construct();
		if ( ! $this->session->userdata('logged_in')) // if not logged in
			redirect('login');
		$this->load->model('hof_model');
	}




	// ------------------------------------------------------------------------




	public function index()
	{
		$data = array(
			'hofs' => $this->hof_model->get_all_final_submission()
		);
		$this->twig->display('pages/hof.twig', $data);
	}




	// ------------------------------------------------------------------------



	/**
	 * Controller for shows the details of the score
	 * Called by ajax request
	 */
	public function hof_details()
	{
		//to do later
	}
}
